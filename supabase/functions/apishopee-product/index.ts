/**
 * Supabase Edge Function: Shopee Product
 * Quản lý Product API với Auto-Refresh Token
 * Hỗ trợ sync products và models vào database
 * 
 * UPDATED: Lấy đầy đủ chi tiết sản phẩm bao gồm:
 * - Hình ảnh (image_url_list)
 * - Giá (current_price, original_price) - từ model nếu có
 * - Tồn kho (total_available_stock) - từ model nếu có
 * - Models/Variants với tier variations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shopee API config
const DEFAULT_PARTNER_ID = Number(Deno.env.get('SHOPEE_PARTNER_ID'));
const DEFAULT_PARTNER_KEY = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
const SHOPEE_BASE_URL = Deno.env.get('SHOPEE_BASE_URL') || 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Batch size for API calls
const BATCH_SIZE_ITEM_INFO = 50;
const DELAY_BETWEEN_CALLS_MS = 100; // Delay để tránh rate limit

interface PartnerCredentials {
  partnerId: number;
  partnerKey: string;
}

// Helper function để delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== HELPER FUNCTIONS ====================

async function getPartnerCredentials(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<PartnerCredentials> {
  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('partner_id, partner_key')
    .eq('shop_id', shopId)
    .single();

  if (data?.partner_id && data?.partner_key && !error) {
    return { partnerId: data.partner_id, partnerKey: data.partner_key };
  }
  return { partnerId: DEFAULT_PARTNER_ID, partnerKey: DEFAULT_PARTNER_KEY };
}

async function fetchWithProxy(targetUrl: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    return await fetch(proxyUrl, options);
  }
  return await fetch(targetUrl, options);
}

function createSignature(
  partnerKey: string,
  partnerId: number,
  path: string,
  timestamp: number,
  accessToken = '',
  shopId = 0
): string {
  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;

  const hmac = createHmac('sha256', partnerKey);
  hmac.update(baseString);
  return hmac.digest('hex');
}

async function refreshAccessToken(
  credentials: PartnerCredentials,
  refreshToken: string,
  shopId: number
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/auth/access_token/get';
  const sign = createSignature(credentials.partnerKey, credentials.partnerId, path, timestamp);

  const url = `${SHOPEE_BASE_URL}${path}?partner_id=${credentials.partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      partner_id: credentials.partnerId,
      shop_id: shopId,
    }),
  });

  return await response.json();
}

async function saveToken(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  token: Record<string, unknown>
) {
  await supabase.from('apishopee_shops').upsert(
    {
      shop_id: shopId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expire_in: token.expire_in,
      expired_at: Date.now() + (token.expire_in as number) * 1000,
      token_updated_at: new Date().toISOString(),
    },
    { onConflict: 'shop_id' }
  );
}

async function getTokenWithAutoRefresh(
  supabase: ReturnType<typeof createClient>,
  shopId: number
) {
  const { data: shopData, error: shopError } = await supabase
    .from('apishopee_shops')
    .select('shop_id, access_token, refresh_token, expired_at')
    .eq('shop_id', shopId)
    .single();

  if (!shopError && shopData?.access_token) {
    return shopData;
  }
  throw new Error('Token not found. Please authenticate first.');
}

async function callShopeeAPI(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  path: string,
  method: 'GET' | 'POST',
  shopId: number,
  token: { access_token: string; refresh_token: string },
  body?: Record<string, unknown>,
  extraParams?: Record<string, string | number | boolean | number[]>
): Promise<unknown> {
  const makeRequest = async (accessToken: string) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = createSignature(credentials.partnerKey, credentials.partnerId, path, timestamp, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: credentials.partnerId.toString(),
      timestamp: timestamp.toString(),
      access_token: accessToken,
      shop_id: shopId.toString(),
      sign: sign,
    });

    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
    console.log('[PRODUCT] Calling:', path);

    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetchWithProxy(url, options);
    return await response.json();
  };

  let result = await makeRequest(token.access_token);

  if (result.error === 'error_auth' || result.message?.includes('Invalid access_token')) {
    console.log('[AUTO-RETRY] Refreshing token...');
    const newToken = await refreshAccessToken(credentials, token.refresh_token, shopId);
    if (!newToken.error) {
      await saveToken(supabase, shopId, newToken);
      result = await makeRequest(newToken.access_token);
    }
  }

  return result;
}


// ==================== PRODUCT API PATHS ====================

const PRODUCT_PATHS = {
  GET_ITEM_LIST: '/api/v2/product/get_item_list',
  GET_ITEM_BASE_INFO: '/api/v2/product/get_item_base_info',
  GET_MODEL_LIST: '/api/v2/product/get_model_list',
};

// ==================== INTERFACES ====================

interface ShopeeItemBasic {
  item_id: number;
  item_status: string;
  update_time: number;
}

interface ShopeeProduct {
  item_id: number;
  item_name: string;
  item_sku: string;
  item_status: string;
  create_time: number;
  update_time: number;
  category_id: number;
  has_model: boolean;
  image: { 
    image_url_list: string[]; 
    image_id_list: string[];
    image_ratio?: string;
  };
  price_info?: Array<{ 
    current_price: number; 
    original_price: number; 
    currency: string 
  }>;
  stock_info_v2?: { 
    summary_info: { 
      total_reserved_stock: number; 
      total_available_stock: number 
    };
    seller_stock?: Array<{ stock: number }>;
  };
  brand?: { 
    brand_id: number; 
    original_brand_name: string 
  };
  description_info?: {
    extended_description?: {
      field_list?: Array<{
        field_type: string;
        text?: string;
        image_info?: { image_url: string };
      }>;
    };
  };
  logistic_info?: Array<{
    logistic_id: number;
    logistic_name: string;
    enabled: boolean;
  }>;
  pre_order?: {
    is_pre_order: boolean;
    days_to_ship: number;
  };
  condition?: string;
  weight?: string;
  dimension?: {
    package_length: number;
    package_width: number;
    package_height: number;
  };
}

interface ShopeeModel {
  model_id: number;
  model_sku: string;
  price_info: Array<{ 
    current_price: number; 
    original_price: number;
    currency?: string;
  }>;
  stock_info_v2?: { 
    summary_info: { 
      total_reserved_stock: number; 
      total_available_stock: number 
    };
    seller_stock?: Array<{ stock: number }>;
  };
  // Fallback fields từ API cũ
  stock_info?: Array<{
    stock_type: number;
    current_stock: number;
    normal_stock: number;
    reserved_stock: number;
  }>;
  tier_index: number[];
}

interface TierVariation {
  name: string;
  option_list: Array<{ 
    option: string; 
    image?: { 
      image_id?: string;
      image_url: string 
    } 
  }>;
}

interface ModelResponse {
  tier_variation: TierVariation[];
  model: ShopeeModel[];
}

// ==================== SYNC FUNCTIONS ====================

/**
 * Sync tất cả products từ Shopee vào database
 * Bao gồm: base info + models/variants với giá và tồn kho chính xác
 */
interface SyncResult {
  success: boolean;
  synced_count: number;
  models_count?: number;
  error?: string;
  api_responses?: {
    item_list_responses: unknown[];
    item_base_info_responses: unknown[];
    model_responses: unknown[];
  };
}

/**
 * Lấy tồn kho từ model response
 */
function getModelStock(model: ShopeeModel): number {
  // Ưu tiên stock_info_v2
  if (model.stock_info_v2?.summary_info?.total_available_stock !== undefined) {
    return model.stock_info_v2.summary_info.total_available_stock;
  }
  // Fallback to stock_info (API cũ)
  if (model.stock_info && model.stock_info.length > 0) {
    return model.stock_info.reduce((sum, s) => sum + (s.current_stock || s.normal_stock || 0), 0);
  }
  return 0;
}

/**
 * Lấy giá từ model response
 */
function getModelPrice(model: ShopeeModel): { current: number; original: number } {
  if (model.price_info && model.price_info.length > 0) {
    return {
      current: model.price_info[0].current_price || 0,
      original: model.price_info[0].original_price || 0,
    };
  }
  return { current: 0, original: 0 };
}

async function syncAllProducts(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  shopId: number,
  userId: string,
  token: { access_token: string; refresh_token: string }
): Promise<SyncResult> {
  // Lưu trữ tất cả API responses
  const apiResponses = {
    item_list_responses: [] as unknown[],
    item_base_info_responses: [] as unknown[],
    model_responses: [] as unknown[],
  };

  try {
    console.log('[SYNC] Starting product sync for shop:', shopId);

    // ========== STEP 1: Lấy danh sách item IDs theo từng status ==========
    const statuses = ['NORMAL', 'UNLIST', 'BANNED'];
    const allItemIds: number[] = [];

    for (const status of statuses) {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_ITEM_LIST, 'GET',
          shopId, token, undefined,
          { offset, page_size: 100, item_status: status }
        ) as { 
          error?: string;
          response?: { 
            item?: ShopeeItemBasic[];
            total_count?: number;
            has_next_page?: boolean;
            next_offset?: number;
          } 
        };

        // Lưu raw response
        apiResponses.item_list_responses.push({
          status,
          api_path: PRODUCT_PATHS.GET_ITEM_LIST,
          response: result,
        });

        if (result.error) {
          console.error(`[SYNC] Error fetching items (status=${status}):`, result.error);
          break;
        }

        const items = result?.response?.item || [];
        const ids = items.map(i => i.item_id);
        allItemIds.push(...ids);
        
        console.log(`[SYNC] Found ${ids.length} items with status ${status} (offset=${offset})`);

        // Check pagination
        hasMore = result?.response?.has_next_page || false;
        offset = result?.response?.next_offset || offset + 100;

        if (hasMore) await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    if (allItemIds.length === 0) {
      console.log('[SYNC] No products found');
      await updateSyncStatus(supabase, shopId, userId);
      return { success: true, synced_count: 0, models_count: 0, api_responses: apiResponses };
    }

    console.log(`[SYNC] Total items found: ${allItemIds.length}`);

    // ========== STEP 2: Lấy chi tiết products theo batch ==========
    const allProducts: ShopeeProduct[] = [];

    for (let i = 0; i < allItemIds.length; i += BATCH_SIZE_ITEM_INFO) {
      const batchIds = allItemIds.slice(i, i + BATCH_SIZE_ITEM_INFO);
      
      const result = await callShopeeAPI(
        supabase, credentials, PRODUCT_PATHS.GET_ITEM_BASE_INFO, 'GET',
        shopId, token, undefined,
        { item_id_list: batchIds }
      ) as { 
        error?: string;
        warning?: string;
        response?: { item_list?: ShopeeProduct[] } 
      };

      // Lưu raw response
      apiResponses.item_base_info_responses.push({
        batch_index: Math.floor(i / BATCH_SIZE_ITEM_INFO),
        item_ids: batchIds,
        api_path: PRODUCT_PATHS.GET_ITEM_BASE_INFO,
        response: result,
      });

      if (result.error) {
        console.error(`[SYNC] Error fetching item details (batch ${i}):`, result.error);
        continue;
      }

      const items = result?.response?.item_list || [];
      allProducts.push(...items);

      if (i + BATCH_SIZE_ITEM_INFO < allItemIds.length) {
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    console.log(`[SYNC] Fetched ${allProducts.length} product details`);

    // ========== STEP 3: Xóa dữ liệu cũ ==========
    console.log('[SYNC] Deleting old data...');
    await supabase.from('apishopee_product_models').delete().eq('shop_id', shopId).eq('user_id', userId);
    await supabase.from('apishopee_product_tier_variations').delete().eq('shop_id', shopId).eq('user_id', userId);
    await supabase.from('apishopee_products').delete().eq('shop_id', shopId).eq('user_id', userId);

    // ========== STEP 4: Lấy models cho TẤT CẢ products có has_model = true ==========
    const productsWithModels = allProducts.filter(p => p.has_model);
    console.log(`[SYNC] *** FETCHING MODELS for ${productsWithModels.length} products with variants ***`);

    // Map để lưu models và tính tổng giá/tồn kho
    const productModelsMap: Map<number, {
      models: ShopeeModel[];
      tierVariations: TierVariation[];
      totalStock: number;
      minPrice: number;
      maxPrice: number;
      minOriginalPrice: number;
      maxOriginalPrice: number;
    }> = new Map();

    let totalModelsCount = 0;

    // Gọi API get_model_list cho từng sản phẩm có variants
    for (let idx = 0; idx < productsWithModels.length; idx++) {
      const product = productsWithModels[idx];
      console.log(`[SYNC] Fetching models for item ${product.item_id} (${idx + 1}/${productsWithModels.length}): ${product.item_name?.substring(0, 50)}...`);
      
      try {
        const modelResult = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_MODEL_LIST, 'GET',
          shopId, token, undefined,
          { item_id: product.item_id }
        ) as { 
          error?: string;
          message?: string;
          response?: ModelResponse 
        };

        // Lưu raw response
        apiResponses.model_responses.push({
          item_id: product.item_id,
          item_name: product.item_name,
          api_path: PRODUCT_PATHS.GET_MODEL_LIST,
          response: modelResult,
        });

        if (modelResult.error) {
          console.error(`[SYNC] Error fetching models for item ${product.item_id}:`, modelResult.error, modelResult.message);
          continue;
        }

        const modelResponse = modelResult?.response;
        if (!modelResponse?.model || modelResponse.model.length === 0) {
          console.log(`[SYNC] No models found for item ${product.item_id}`);
          continue;
        }

        console.log(`[SYNC] Found ${modelResponse.model.length} models for item ${product.item_id}`);

        // Tính tổng tồn kho và range giá từ models
        let totalStock = 0;
        let minPrice = Infinity;
        let maxPrice = 0;
        let minOriginalPrice = Infinity;
        let maxOriginalPrice = 0;

        for (const model of modelResponse.model) {
          const stock = getModelStock(model);
          const price = getModelPrice(model);
          
          totalStock += stock;
          if (price.current > 0) {
            minPrice = Math.min(minPrice, price.current);
            maxPrice = Math.max(maxPrice, price.current);
          }
          if (price.original > 0) {
            minOriginalPrice = Math.min(minOriginalPrice, price.original);
            maxOriginalPrice = Math.max(maxOriginalPrice, price.original);
          }
        }

        productModelsMap.set(product.item_id, {
          models: modelResponse.model,
          tierVariations: modelResponse.tier_variation || [],
          totalStock,
          minPrice: minPrice === Infinity ? 0 : minPrice,
          maxPrice,
          minOriginalPrice: minOriginalPrice === Infinity ? 0 : minOriginalPrice,
          maxOriginalPrice,
        });

        totalModelsCount += modelResponse.model.length;

        // Delay để tránh rate limit
        await delay(DELAY_BETWEEN_CALLS_MS);
      } catch (err) {
        console.error(`[SYNC] Exception fetching models for item ${product.item_id}:`, err);
      }
    }

    console.log(`[SYNC] *** TOTAL MODELS FETCHED: ${totalModelsCount} ***`);

    // ========== STEP 5: Insert products với giá/tồn kho chính xác ==========
    console.log('[SYNC] Inserting products...');
    
    const productData = allProducts.map(p => {
      const modelInfo = productModelsMap.get(p.item_id);
      
      // Nếu có models, lấy giá và tồn kho từ models
      let currentPrice = p.price_info?.[0]?.current_price || 0;
      let originalPrice = p.price_info?.[0]?.original_price || 0;
      let totalAvailableStock = p.stock_info_v2?.summary_info?.total_available_stock || 0;
      let totalReservedStock = p.stock_info_v2?.summary_info?.total_reserved_stock || 0;

      if (modelInfo && modelInfo.models.length > 0) {
        // Sử dụng giá thấp nhất từ models làm current_price
        currentPrice = modelInfo.minPrice;
        // Sử dụng giá gốc cao nhất từ models làm original_price
        originalPrice = modelInfo.maxOriginalPrice > 0 ? modelInfo.maxOriginalPrice : modelInfo.maxPrice;
        // Tổng tồn kho từ tất cả models
        totalAvailableStock = modelInfo.totalStock;
      }

      return {
        shop_id: shopId,
        user_id: userId,
        item_id: p.item_id,
        item_name: p.item_name,
        item_sku: p.item_sku || '',
        item_status: p.item_status,
        category_id: p.category_id,
        image_url_list: p.image?.image_url_list || [],
        image_id_list: p.image?.image_id_list || [],
        current_price: currentPrice,
        original_price: originalPrice,
        currency: p.price_info?.[0]?.currency || 'VND',
        total_available_stock: totalAvailableStock,
        total_reserved_stock: totalReservedStock,
        brand_id: p.brand?.brand_id || null,
        brand_name: p.brand?.original_brand_name || null,
        has_model: p.has_model,
        create_time: p.create_time,
        update_time: p.update_time,
        raw_response: p,
        synced_at: new Date().toISOString(),
      };
    });

    const { error: insertError } = await supabase.from('apishopee_products').insert(productData);
    if (insertError) {
      console.error('[SYNC] Insert products error:', insertError);
      throw new Error(`Insert products failed: ${insertError.message}`);
    }

    // ========== STEP 6: Insert tier variations và models ==========
    console.log('[SYNC] Inserting models and tier variations...');

    for (const [itemId, modelInfo] of productModelsMap) {
      const product = allProducts.find(p => p.item_id === itemId);
      if (!product) continue;

      // Insert tier variations
      if (modelInfo.tierVariations.length > 0) {
        const { error: tierError } = await supabase.from('apishopee_product_tier_variations').insert({
          shop_id: shopId,
          user_id: userId,
          item_id: itemId,
          tier_variations: modelInfo.tierVariations,
          synced_at: new Date().toISOString(),
        });
        if (tierError) {
          console.error(`[SYNC] Insert tier variations error for item ${itemId}:`, tierError);
        }
      }

      // Insert models
      if (modelInfo.models.length > 0) {
        const modelData = modelInfo.models.map(m => {
          // Tạo model name từ tier variations
          let modelName = m.model_sku || '';
          if (modelInfo.tierVariations.length > 0 && m.tier_index) {
            const parts = m.tier_index.map((idx, i) => {
              const tier = modelInfo.tierVariations[i];
              return tier?.option_list?.[idx]?.option || '';
            }).filter(Boolean);
            if (parts.length > 0) modelName = parts.join(' - ');
          }

          // Lấy image từ tier variation (thường là tier đầu tiên)
          let imageUrl: string | null = null;
          if (modelInfo.tierVariations.length > 0 && m.tier_index && m.tier_index.length > 0) {
            const firstTier = modelInfo.tierVariations[0];
            const firstIdx = m.tier_index[0];
            imageUrl = firstTier?.option_list?.[firstIdx]?.image?.image_url || null;
          }

          const price = getModelPrice(m);
          const stock = getModelStock(m);

          return {
            shop_id: shopId,
            user_id: userId,
            item_id: itemId,
            model_id: m.model_id,
            model_sku: m.model_sku || '',
            model_name: modelName,
            current_price: price.current,
            original_price: price.original,
            total_available_stock: stock,
            total_reserved_stock: m.stock_info_v2?.summary_info?.total_reserved_stock || 0,
            tier_index: m.tier_index,
            image_url: imageUrl,
            raw_response: m,
            synced_at: new Date().toISOString(),
          };
        });

        const { error: modelInsertError } = await supabase.from('apishopee_product_models').insert(modelData);
        if (modelInsertError) {
          console.error(`[SYNC] Insert models error for item ${itemId}:`, modelInsertError);
        } else {
          console.log(`[SYNC] Inserted ${modelData.length} models for item ${itemId}`);
        }
      }
    }

    // ========== STEP 7: Update sync status ==========
    await updateSyncStatus(supabase, shopId, userId);

    console.log(`[SYNC] *** SYNC COMPLETED: ${allProducts.length} products, ${totalModelsCount} models ***`);
    return { 
      success: true, 
      synced_count: allProducts.length, 
      models_count: totalModelsCount,
      api_responses: apiResponses 
    };

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[SYNC] Error:', errorMessage);
    return { success: false, synced_count: 0, error: errorMessage, api_responses: apiResponses };
  }
}

async function updateSyncStatus(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string
) {
  await supabase.from('apishopee_sync_status').upsert({
    shop_id: shopId,
    user_id: userId,
    products_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id,user_id' });
}

/**
 * Gọi Edge Function để tạo history logs
 */
async function createHistoryLogs(
  supabase: ReturnType<typeof createClient>,
  diffs: Array<{
    shop_id: number;
    user_id: string;
    item_id: number;
    item_name: string;
    old_data: Record<string, unknown>;
    new_data: Record<string, unknown>;
    shopee_timestamp?: number;
    raw_response?: unknown;
  }>
): Promise<{ logs_created: number; errors: string[] }> {
  if (diffs.length === 0) return { logs_created: 0, errors: [] };

  try {
    const { data, error } = await supabase.functions.invoke('apishopee-product-webhook', {
      body: { action: 'process-diff', diffs },
    });

    if (error) {
      console.error('[HISTORY] Error calling webhook function:', error);
      return { logs_created: 0, errors: [error.message] };
    }

    return { logs_created: data?.logs_created || 0, errors: data?.errors || [] };
  } catch (err) {
    console.error('[HISTORY] Exception:', err);
    return { logs_created: 0, errors: [(err as Error).message] };
  }
}

/**
 * Log sản phẩm mới được tạo
 */
async function logProductCreated(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  product: { item_id: number; item_name: string; current_price: number; total_available_stock: number; update_time?: number },
  rawResponse?: unknown
): Promise<void> {
  try {
    await supabase.functions.invoke('apishopee-product-webhook', {
      body: {
        action: 'log-product-created',
        shop_id: shopId,
        user_id: userId,
        item_id: product.item_id,
        item_name: product.item_name,
        current_price: product.current_price,
        total_stock: product.total_available_stock,
        shopee_timestamp: product.update_time,
        raw_response: rawResponse,
      },
    });
  } catch (err) {
    console.error('[HISTORY] Error logging product created:', err);
  }
}

/**
 * Log sản phẩm bị xóa
 */
async function logProductDeleted(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  itemId: number,
  itemName?: string
): Promise<void> {
  try {
    await supabase.functions.invoke('apishopee-product-webhook', {
      body: {
        action: 'log-product-deleted',
        shop_id: shopId,
        user_id: userId,
        item_id: itemId,
        item_name: itemName,
      },
    });
  } catch (err) {
    console.error('[HISTORY] Error logging product deleted:', err);
  }
}

/**
 * Incremental sync - chỉ update những products thay đổi
 * Không xóa toàn bộ, chỉ UPDATE/INSERT/DELETE theo item_id
 * Tích hợp History Logging để theo dõi thay đổi
 */
async function incrementalSyncProducts(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  shopId: number,
  userId: string,
  token: { access_token: string; refresh_token: string },
  changedItemIds: number[]
): Promise<{ success: boolean; updated_count: number; inserted_count: number; deleted_count: number; history_logs_created?: number; error?: string }> {
  try {
    console.log(`[INCREMENTAL] Starting incremental sync for ${changedItemIds.length} changed items`);

    // Biến để track history logs
    let historyLogsCreated = 0;

    // ========== STEP 1: Lấy tất cả item_ids hiện tại từ Shopee ==========
    const statuses = ['NORMAL', 'UNLIST', 'BANNED'];
    const allShopeeItemIds: number[] = [];

    for (const status of statuses) {
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_ITEM_LIST, 'GET',
          shopId, token, undefined,
          { offset, page_size: 100, item_status: status }
        ) as {
          error?: string;
          response?: {
            item?: ShopeeItemBasic[];
            has_next_page?: boolean;
            next_offset?: number;
          }
        };

        if (result.error) break;

        const items = result?.response?.item || [];
        allShopeeItemIds.push(...items.map(i => i.item_id));

        hasMore = result?.response?.has_next_page || false;
        offset = result?.response?.next_offset || offset + 100;

        if (hasMore) await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    // ========== STEP 2: Lấy item_ids hiện có trong DB (với thông tin để so sánh và log) ==========
    const { data: dbProducts } = await supabase
      .from('apishopee_products')
      .select('item_id, item_name, current_price, original_price, total_available_stock, item_status')
      .eq('shop_id', shopId)
      .eq('user_id', userId);

    const dbProductsMap = new Map((dbProducts || []).map(p => [p.item_id, p]));
    const dbItemIds = new Set((dbProducts || []).map(p => p.item_id));
    const shopeeItemIds = new Set(allShopeeItemIds);

    // ========== STEP 3: Xác định items cần DELETE (có trong DB nhưng không còn trên Shopee) ==========
    const itemsToDelete = [...dbItemIds].filter(id => !shopeeItemIds.has(id));
    let deletedCount = 0;

    if (itemsToDelete.length > 0) {
      console.log(`[INCREMENTAL] Deleting ${itemsToDelete.length} removed items`);

      // Log sản phẩm bị xóa vào history
      for (const itemId of itemsToDelete) {
        const oldProduct = dbProductsMap.get(itemId);
        await logProductDeleted(supabase, shopId, userId, itemId, oldProduct?.item_name);
        historyLogsCreated++;
      }

      // Xóa models và tier variations trước
      await supabase.from('apishopee_product_models')
        .delete()
        .eq('shop_id', shopId)
        .eq('user_id', userId)
        .in('item_id', itemsToDelete);

      await supabase.from('apishopee_product_tier_variations')
        .delete()
        .eq('shop_id', shopId)
        .eq('user_id', userId)
        .in('item_id', itemsToDelete);

      // Xóa products
      const { count } = await supabase.from('apishopee_products')
        .delete()
        .eq('shop_id', shopId)
        .eq('user_id', userId)
        .in('item_id', itemsToDelete);

      deletedCount = count || itemsToDelete.length;
    }

    // ========== STEP 4: Xác định items cần INSERT (mới trên Shopee) ==========
    const itemsToInsert = [...shopeeItemIds].filter(id => !dbItemIds.has(id));

    // ========== STEP 5: Tổng hợp items cần fetch chi tiết (changed + new) ==========
    const itemsToFetch = [...new Set([...changedItemIds, ...itemsToInsert])];

    if (itemsToFetch.length === 0) {
      console.log('[INCREMENTAL] No items to update');
      await updateSyncStatus(supabase, shopId, userId);
      return { success: true, updated_count: 0, inserted_count: 0, deleted_count: deletedCount };
    }

    console.log(`[INCREMENTAL] Fetching details for ${itemsToFetch.length} items (${changedItemIds.length} changed, ${itemsToInsert.length} new)`);

    // ========== STEP 6: Lấy chi tiết products ==========
    const allProducts: ShopeeProduct[] = [];

    for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE_ITEM_INFO) {
      const batchIds = itemsToFetch.slice(i, i + BATCH_SIZE_ITEM_INFO);

      const result = await callShopeeAPI(
        supabase, credentials, PRODUCT_PATHS.GET_ITEM_BASE_INFO, 'GET',
        shopId, token, undefined,
        { item_id_list: batchIds }
      ) as { error?: string; response?: { item_list?: ShopeeProduct[] } };

      if (!result.error) {
        allProducts.push(...(result?.response?.item_list || []));
      }

      if (i + BATCH_SIZE_ITEM_INFO < itemsToFetch.length) {
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    // ========== STEP 7: Lấy models cho products có has_model = true ==========
    const productsWithModels = allProducts.filter(p => p.has_model);
    const productModelsMap: Map<number, {
      models: ShopeeModel[];
      tierVariations: TierVariation[];
      totalStock: number;
      minPrice: number;
      maxPrice: number;
      minOriginalPrice: number;
      maxOriginalPrice: number;
    }> = new Map();

    for (const product of productsWithModels) {
      try {
        const modelResult = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_MODEL_LIST, 'GET',
          shopId, token, undefined,
          { item_id: product.item_id }
        ) as { error?: string; response?: ModelResponse };

        if (!modelResult.error && modelResult?.response?.model) {
          const modelResponse = modelResult.response;
          let totalStock = 0;
          let minPrice = Infinity;
          let maxPrice = 0;
          let minOriginalPrice = Infinity;
          let maxOriginalPrice = 0;

          for (const model of modelResponse.model) {
            const stock = getModelStock(model);
            const price = getModelPrice(model);

            totalStock += stock;
            if (price.current > 0) {
              minPrice = Math.min(minPrice, price.current);
              maxPrice = Math.max(maxPrice, price.current);
            }
            if (price.original > 0) {
              minOriginalPrice = Math.min(minOriginalPrice, price.original);
              maxOriginalPrice = Math.max(maxOriginalPrice, price.original);
            }
          }

          productModelsMap.set(product.item_id, {
            models: modelResponse.model,
            tierVariations: modelResponse.tier_variation || [],
            totalStock,
            minPrice: minPrice === Infinity ? 0 : minPrice,
            maxPrice,
            minOriginalPrice: minOriginalPrice === Infinity ? 0 : minOriginalPrice,
            maxOriginalPrice,
          });
        }

        await delay(DELAY_BETWEEN_CALLS_MS);
      } catch (err) {
        console.error(`[INCREMENTAL] Error fetching models for item ${product.item_id}:`, err);
      }
    }

    // ========== STEP 8: UPSERT products (insert or update) + HISTORY LOGGING ==========
    let insertedCount = 0;
    let updatedCount = 0;
    const diffsToLog: Array<{
      shop_id: number;
      user_id: string;
      item_id: number;
      item_name: string;
      old_data: Record<string, unknown>;
      new_data: Record<string, unknown>;
      shopee_timestamp?: number;
      raw_response?: unknown;
    }> = [];

    for (const p of allProducts) {
      const modelInfo = productModelsMap.get(p.item_id);

      let currentPrice = p.price_info?.[0]?.current_price || 0;
      let originalPrice = p.price_info?.[0]?.original_price || 0;
      let totalAvailableStock = p.stock_info_v2?.summary_info?.total_available_stock || 0;
      const totalReservedStock = p.stock_info_v2?.summary_info?.total_reserved_stock || 0;

      if (modelInfo && modelInfo.models.length > 0) {
        currentPrice = modelInfo.minPrice;
        originalPrice = modelInfo.maxOriginalPrice > 0 ? modelInfo.maxOriginalPrice : modelInfo.maxPrice;
        totalAvailableStock = modelInfo.totalStock;
      }

      const productData = {
        shop_id: shopId,
        user_id: userId,
        item_id: p.item_id,
        item_name: p.item_name,
        item_sku: p.item_sku || '',
        item_status: p.item_status,
        category_id: p.category_id,
        image_url_list: p.image?.image_url_list || [],
        image_id_list: p.image?.image_id_list || [],
        current_price: currentPrice,
        original_price: originalPrice,
        currency: p.price_info?.[0]?.currency || 'VND',
        total_available_stock: totalAvailableStock,
        total_reserved_stock: totalReservedStock,
        brand_id: p.brand?.brand_id || null,
        brand_name: p.brand?.original_brand_name || null,
        has_model: p.has_model,
        create_time: p.create_time,
        update_time: p.update_time,
        raw_response: p,
        synced_at: new Date().toISOString(),
      };

      const isNew = itemsToInsert.includes(p.item_id);
      const oldProduct = dbProductsMap.get(p.item_id);

      // So sánh và tạo diff cho history logging (chỉ cho sản phẩm cập nhật)
      if (!isNew && oldProduct) {
        const hasChanges =
          oldProduct.current_price !== currentPrice ||
          oldProduct.total_available_stock !== totalAvailableStock ||
          oldProduct.item_status !== p.item_status ||
          oldProduct.item_name !== p.item_name;

        if (hasChanges) {
          diffsToLog.push({
            shop_id: shopId,
            user_id: userId,
            item_id: p.item_id,
            item_name: p.item_name,
            old_data: {
              current_price: oldProduct.current_price,
              original_price: oldProduct.original_price,
              total_available_stock: oldProduct.total_available_stock,
              item_status: oldProduct.item_status,
              item_name: oldProduct.item_name,
            },
            new_data: {
              current_price: currentPrice,
              original_price: originalPrice,
              total_available_stock: totalAvailableStock,
              item_status: p.item_status,
              item_name: p.item_name,
            },
            shopee_timestamp: p.update_time,
            raw_response: p,
          });
        }
      }

      // Upsert product
      await supabase.from('apishopee_products').upsert(productData, {
        onConflict: 'shop_id,user_id,item_id',
      });

      if (isNew) {
        insertedCount++;
        // Log sản phẩm mới
        await logProductCreated(supabase, shopId, userId, {
          item_id: p.item_id,
          item_name: p.item_name,
          current_price: currentPrice,
          total_available_stock: totalAvailableStock,
          update_time: p.update_time,
        }, p);
        historyLogsCreated++;
      } else {
        updatedCount++;
      }

      // Update models nếu có
      if (modelInfo) {
        // Xóa models cũ
        await supabase.from('apishopee_product_models')
          .delete()
          .eq('shop_id', shopId)
          .eq('user_id', userId)
          .eq('item_id', p.item_id);

        await supabase.from('apishopee_product_tier_variations')
          .delete()
          .eq('shop_id', shopId)
          .eq('user_id', userId)
          .eq('item_id', p.item_id);

        // Insert tier variations mới
        if (modelInfo.tierVariations.length > 0) {
          await supabase.from('apishopee_product_tier_variations').insert({
            shop_id: shopId,
            user_id: userId,
            item_id: p.item_id,
            tier_variations: modelInfo.tierVariations,
            synced_at: new Date().toISOString(),
          });
        }

        // Insert models mới
        if (modelInfo.models.length > 0) {
          const modelData = modelInfo.models.map(m => {
            let modelName = m.model_sku || '';
            if (modelInfo.tierVariations.length > 0 && m.tier_index) {
              const parts = m.tier_index.map((idx, i) => {
                const tier = modelInfo.tierVariations[i];
                return tier?.option_list?.[idx]?.option || '';
              }).filter(Boolean);
              if (parts.length > 0) modelName = parts.join(' - ');
            }

            let imageUrl: string | null = null;
            if (modelInfo.tierVariations.length > 0 && m.tier_index && m.tier_index.length > 0) {
              const firstTier = modelInfo.tierVariations[0];
              const firstIdx = m.tier_index[0];
              imageUrl = firstTier?.option_list?.[firstIdx]?.image?.image_url || null;
            }

            const price = getModelPrice(m);
            const stock = getModelStock(m);

            return {
              shop_id: shopId,
              user_id: userId,
              item_id: p.item_id,
              model_id: m.model_id,
              model_sku: m.model_sku || '',
              model_name: modelName,
              current_price: price.current,
              original_price: price.original,
              total_available_stock: stock,
              total_reserved_stock: m.stock_info_v2?.summary_info?.total_reserved_stock || 0,
              tier_index: m.tier_index,
              image_url: imageUrl,
              raw_response: m,
              synced_at: new Date().toISOString(),
            };
          });

          await supabase.from('apishopee_product_models').insert(modelData);
        }
      }
    }

    // ========== STEP 9: Tạo history logs cho các thay đổi đã phát hiện ==========
    if (diffsToLog.length > 0) {
      console.log(`[INCREMENTAL] Creating history logs for ${diffsToLog.length} changed products`);
      const historyResult = await createHistoryLogs(supabase, diffsToLog);
      historyLogsCreated += historyResult.logs_created;
      if (historyResult.errors.length > 0) {
        console.warn('[INCREMENTAL] History logging errors:', historyResult.errors);
      }
    }

    // ========== STEP 10: Update sync status ==========
    await updateSyncStatus(supabase, shopId, userId);

    console.log(`[INCREMENTAL] Completed: ${insertedCount} inserted, ${updatedCount} updated, ${deletedCount} deleted, ${historyLogsCreated} history logs`);
    return { success: true, updated_count: updatedCount, inserted_count: insertedCount, deleted_count: deletedCount, history_logs_created: historyLogsCreated };

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[INCREMENTAL] Error:', errorMessage);
    return { success: false, updated_count: 0, inserted_count: 0, deleted_count: 0, history_logs_created: 0, error: errorMessage };
  }
}


// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, shop_id, user_id } = body;

    if (!shop_id) {
      return new Response(JSON.stringify({ error: 'shop_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const credentials = await getPartnerCredentials(supabase, shop_id);
    const token = await getTokenWithAutoRefresh(supabase, shop_id);

    let result;

    switch (action) {
      // ==================== GET ITEM LIST ====================
      case 'get-item-list': {
        const { offset = 0, page_size = 100, item_status = ['NORMAL'] } = body;
        result = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_ITEM_LIST, 'GET',
          shop_id, token, undefined,
          { offset, page_size, item_status: Array.isArray(item_status) ? item_status.join(',') : item_status }
        );
        break;
      }

      // ==================== GET ITEM BASE INFO ====================
      case 'get-item-base-info': {
        const { item_id_list } = body;
        if (!item_id_list || !Array.isArray(item_id_list)) {
          return new Response(JSON.stringify({ error: 'item_id_list is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_ITEM_BASE_INFO, 'GET',
          shop_id, token, undefined,
          { item_id_list }
        );
        break;
      }

      // ==================== GET MODEL LIST ====================
      case 'get-model-list': {
        const { item_id } = body;
        if (!item_id) {
          return new Response(JSON.stringify({ error: 'item_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await callShopeeAPI(
          supabase, credentials, PRODUCT_PATHS.GET_MODEL_LIST, 'GET',
          shop_id, token, undefined,
          { item_id }
        );
        break;
      }

      // ==================== SYNC ALL PRODUCTS ====================
      case 'sync-products': {
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id is required for sync' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await syncAllProducts(supabase, credentials, shop_id, user_id, token);
        break;
      }

      // ==================== CHECK FOR UPDATES (Incremental Sync) ====================
      case 'check-updates': {
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Kiểm tra xem DB đã có data chưa
        const { count: existingCount } = await supabase
          .from('apishopee_products')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop_id)
          .eq('user_id', user_id);

        // Nếu chưa có data -> full sync lần đầu
        if (!existingCount || existingCount === 0) {
          console.log('[CHECK] No existing data, running full sync...');
          result = await syncAllProducts(supabase, credentials, shop_id, user_id, token);
          break;
        }

        // Lấy update_time mới nhất từ database
        const { data: latestProduct } = await supabase
          .from('apishopee_products')
          .select('update_time')
          .eq('shop_id', shop_id)
          .eq('user_id', user_id)
          .order('update_time', { ascending: false })
          .limit(1)
          .single();

        const lastUpdateTime = latestProduct?.update_time || 0;

        // Lấy danh sách products đã thay đổi từ Shopee (có update_time > lastUpdateTime)
        const statuses = ['NORMAL', 'UNLIST', 'BANNED'];
        const changedItemIds: number[] = [];

        for (const status of statuses) {
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            const apiResult = await callShopeeAPI(
              supabase, credentials, PRODUCT_PATHS.GET_ITEM_LIST, 'GET',
              shop_id, token, undefined,
              { offset, page_size: 100, item_status: status, update_time_from: lastUpdateTime + 1 }
            ) as { response?: { item?: Array<{ item_id: number; update_time: number }>; has_next_page?: boolean; next_offset?: number } };

            const items = apiResult?.response?.item || [];
            changedItemIds.push(...items.map(i => i.item_id));

            hasMore = apiResult?.response?.has_next_page || false;
            offset = apiResult?.response?.next_offset || offset + 100;

            if (hasMore) await delay(DELAY_BETWEEN_CALLS_MS);
          }
        }

        if (changedItemIds.length > 0) {
          // Có thay đổi -> incremental sync
          console.log(`[CHECK] Found ${changedItemIds.length} changed items, running incremental sync...`);
          const incrementalResult = await incrementalSyncProducts(supabase, credentials, shop_id, user_id, token, changedItemIds);
          result = {
            success: incrementalResult.success,
            has_changes: true,
            synced_count: incrementalResult.updated_count + incrementalResult.inserted_count,
            updated_count: incrementalResult.updated_count,
            inserted_count: incrementalResult.inserted_count,
            deleted_count: incrementalResult.deleted_count,
            error: incrementalResult.error,
          };
        } else {
          // Không có thay đổi từ update_time, nhưng vẫn check xem có products bị xóa không
          const incrementalResult = await incrementalSyncProducts(supabase, credentials, shop_id, user_id, token, []);
          if (incrementalResult.deleted_count > 0) {
            result = {
              success: true,
              has_changes: true,
              synced_count: 0,
              deleted_count: incrementalResult.deleted_count,
              message: `Đã xóa ${incrementalResult.deleted_count} sản phẩm không còn tồn tại`,
            };
          } else {
            result = { success: true, has_changes: false, message: 'No changes detected' };
          }
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[PRODUCT] Error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      success: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
