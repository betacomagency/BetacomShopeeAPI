/**
 * Flash Sale Auto Scheduler Worker
 * 
 * Chạy định kỳ để xử lý các scheduled flash sale jobs:
 * 1. Tìm các jobs có status='scheduled' và scheduled_at <= now
 * 2. Kiểm tra xem timeslot đã có Flash Sale chưa (tạo thủ công trên Shopee)
 * 3. Nếu chưa có -> tạo FS và thêm sản phẩm
 * 4. Nếu đã có -> cập nhật status='error' với message phù hợp
 * 
 * Trigger: Supabase cron job hoặc external scheduler (mỗi 1-2 phút)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';
import { logApiCall, getApiCallStatus, createResponseSummary, extractUserFromJwt, determineTriggeredBy } from '../_shared/api-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PARTNER_ID = Number(Deno.env.get('SHOPEE_PARTNER_ID'));
const DEFAULT_PARTNER_KEY = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
const SHOPEE_BASE_URL = Deno.env.get('SHOPEE_BASE_URL') || 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface PartnerCredentials {
  partnerId: number;
  partnerKey: string;
}

interface ScheduledJob {
  id: string;
  shop_id: number;
  user_id: string;
  timeslot_id: number;
  slot_start_time: number;
  slot_end_time: number;
  items_count: number;
  scheduled_at: string;
  retry_count?: number;
}

// Retry configuration
const MAX_RETRY_COUNT = 3;
/** Exponential backoff: 1min → 3min → 5min based on retry count */
function getRetryDelayMinutes(retryCount: number): number {
  const delays = [1, 3, 5];
  return delays[Math.min(retryCount, delays.length - 1)];
}
const ALERT_WEBHOOK_URL = Deno.env.get('FLASH_SALE_ALERT_WEBHOOK') || '';

/**
 * Classify if an error is transient (can be retried)
 */
function isTransientError(error: string): boolean {
  const transientPatterns = [
    'network',
    'timeout',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'rate_limit',
    'too_many_requests',
    '429',
    '500',
    '502',
    '503',
    '504',
    'temporarily_unavailable',
    'service_unavailable',
  ];
  const lowerError = error.toLowerCase();
  return transientPatterns.some(p => lowerError.includes(p.toLowerCase()));
}

/**
 * Send alert webhook for permanent failures
 */
async function sendFailureAlert(job: ScheduledJob, errorMsg: string): Promise<void> {
  if (!ALERT_WEBHOOK_URL) return;

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `❌ Flash Sale Auto FAILED (after ${job.retry_count || 0} retries)\n` +
              `• Shop: ${job.shop_id}\n` +
              `• Timeslot: ${job.timeslot_id}\n` +
              `• Error: ${errorMsg}`,
        shop_id: job.shop_id,
        timeslot_id: job.timeslot_id,
        error: errorMsg,
        retry_count: job.retry_count || 0,
      }),
    });
    console.log(`[SCHEDULER] Alert sent for job ${job.id}`);
  } catch (e) {
    console.error(`[SCHEDULER] Failed to send alert:`, (e as Error).message);
  }
}

interface FlashSaleItem {
  item_id: number;
  item_name?: string;
  status: number;
  purchase_limit: number;
  campaign_stock?: number;
  input_promotion_price?: number;
  models?: FlashSaleModel[];
}

interface FlashSaleModel {
  model_id: number;
  item_id: number;
  input_promotion_price: number;
  campaign_stock: number;
  status?: number;
}

// ==================== HELPER FUNCTIONS ====================

async function getPartnerCredentials(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<PartnerCredentials> {
  const { data } = await supabase
    .from('apishopee_shops')
    .select('partner_id, partner_key')
    .eq('shop_id', shopId)
    .single();

  if (data?.partner_id && data?.partner_key) {
    return { partnerId: data.partner_id, partnerKey: data.partner_key };
  }
  return { partnerId: DEFAULT_PARTNER_ID, partnerKey: DEFAULT_PARTNER_KEY };
}

async function fetchWithProxy(targetUrl: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    const proxyOptions = {
      ...options,
      headers: { ...(options.headers || {}), 'x-target-url': targetUrl },
    };
    return await fetch(PROXY_URL, proxyOptions);
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
  await supabase.from('apishopee_shops').upsert({
    shop_id: shopId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expire_in: token.expire_in,
    expired_at: Date.now() + (token.expire_in as number) * 1000,
    token_updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id' });
}

async function getTokenWithAutoRefresh(
  supabase: ReturnType<typeof createClient>,
  shopId: number
) {
  const { data } = await supabase
    .from('apishopee_shops')
    .select('shop_id, access_token, refresh_token, expired_at')
    .eq('shop_id', shopId)
    .single();

  if (data?.access_token) return data;
  throw new Error('Token not found');
}

async function callShopeeAPI(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  path: string,
  method: 'GET' | 'POST',
  shopId: number,
  token: { access_token: string; refresh_token: string },
  body?: Record<string, unknown>,
  extraParams?: Record<string, string | number | boolean>,
  callerUserId?: string,
  callerUserEmail?: string,
  triggeredBy?: string
): Promise<unknown> {
  const startTime = Date.now();
  let wasTokenRefreshed = false;

  const logCall = (status: 'success' | 'failed' | 'timeout', duration: number, opts?: {
    shopeeError?: string; shopeeMessage?: string; responseSummary?: Record<string, unknown>;
    tokenRefreshed?: boolean;
  }) => {
    logApiCall(supabase, {
      shopId,
      partnerId: credentials.partnerId,
      edgeFunction: 'apishopee-flash-sale-scheduler',
      apiEndpoint: path,
      httpMethod: method,
      apiCategory: 'flash_sale',
      status,
      shopeeError: opts?.shopeeError,
      shopeeMessage: opts?.shopeeMessage,
      durationMs: duration,
      responseSummary: opts?.responseSummary,
      wasTokenRefreshed: opts?.tokenRefreshed ?? wasTokenRefreshed,
      userId: callerUserId,
      userEmail: callerUserEmail,
      triggeredBy: triggeredBy as 'user' | 'cron' | 'scheduler' | 'webhook' | 'system' | undefined,
    });
  };

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
          params.append(key, value.toString());
        }
      });
    }

    const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetchWithProxy(url, options);
      return await response.json();
    } catch (fetchError) {
      const err = fetchError as Error;
      return { error: 'network_error', message: err.message || 'Network request failed' };
    }
  };

  try {
    let result = await makeRequest(token.access_token);

    if (result.error === 'error_auth' || result.message?.includes('Invalid access_token')) {
      const firstCallStatus = getApiCallStatus(result as Record<string, unknown>);
      logCall(firstCallStatus.status, Date.now() - startTime, {
        shopeeError: firstCallStatus.shopeeError,
        shopeeMessage: firstCallStatus.shopeeMessage,
        responseSummary: createResponseSummary(result as Record<string, unknown>),
      });

      console.log('[SCHEDULER] Token invalid, refreshing...');
      const retryStartTime = Date.now();
      const newToken = await refreshAccessToken(credentials, token.refresh_token, shopId);
      if (!newToken.error) {
        await saveToken(supabase, shopId, newToken);
        wasTokenRefreshed = true;
        result = await makeRequest(newToken.access_token);
      }

      const retryStatus = getApiCallStatus(result as Record<string, unknown>);
      logCall(retryStatus.status, Date.now() - retryStartTime, {
        shopeeError: retryStatus.shopeeError,
        shopeeMessage: retryStatus.shopeeMessage,
        responseSummary: createResponseSummary(result as Record<string, unknown>),
        tokenRefreshed: true,
      });

      return result;
    }

    // Log API call
    const apiStatus = getApiCallStatus(result as Record<string, unknown>);
    logCall(apiStatus.status, Date.now() - startTime, {
      shopeeError: apiStatus.shopeeError,
      shopeeMessage: apiStatus.shopeeMessage,
      responseSummary: createResponseSummary(result as Record<string, unknown>),
    });

    return result;
  } catch (err) {
    logCall('failed', Date.now() - startTime, {
      shopeeError: 'edge_function_error',
      shopeeMessage: (err as Error).message || 'Unexpected error in callShopeeAPI',
    });
    throw err;
  }
}

// ==================== MAIN LOGIC ====================

/**
 * Kiểm tra xem timeslot đã có Flash Sale chưa
 */
async function checkTimeslotHasFlashSale(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  shopId: number,
  token: { access_token: string; refresh_token: string },
  timeslotId: number,
  callerUserId?: string,
  callerUserEmail?: string,
  triggeredBy?: string
): Promise<{ exists: boolean; flashSaleId?: number }> {
  // Lấy danh sách Flash Sale sắp tới (type=1) và đang chạy (type=2)
  const result = await callShopeeAPI(
    supabase,
    credentials,
    '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
    'GET',
    shopId,
    token,
    undefined,
    { type: 0, offset: 0, limit: 100 }, // type=0 lấy tất cả
    callerUserId,
    callerUserEmail,
    triggeredBy
  ) as { response?: { flash_sale_list?: Array<{ timeslot_id: number; flash_sale_id: number; type: number }> } };

  const flashSaleList = result?.response?.flash_sale_list || [];
  
  // Tìm FS có cùng timeslot_id và đang active (type 1 hoặc 2)
  const existingFS = flashSaleList.find(
    fs => fs.timeslot_id === timeslotId && (fs.type === 1 || fs.type === 2)
  );

  if (existingFS) {
    return { exists: true, flashSaleId: existingFS.flash_sale_id };
  }

  return { exists: false };
}

/**
 * Lấy template items từ Flash Sale gần nhất
 */
/**
 * Parse items từ Shopee API response thành format để add vào FS mới
 */
function parseFlashSaleItems(
  result: { response?: { item_info?: FlashSaleItem[]; models?: FlashSaleModel[] }; error?: string; message?: string }
): Array<Record<string, unknown>> {
  // Kiểm tra lỗi từ Shopee (VD: flash_sale_not_exist)
  if (result.error) {
    console.log(`[SCHEDULER][parseItems] Shopee API error: ${result.error} - ${result.message}`);
    return [];
  }

  const itemInfoList = result?.response?.item_info || [];
  const modelsList = result?.response?.models || [];

  console.log(`[SCHEDULER][parseItems] Raw data: ${itemInfoList.length} items, ${modelsList.length} models`);

  // Map items với models
  const itemsWithModels = itemInfoList.map((item: FlashSaleItem) => {
    const itemModels = modelsList.filter((m: FlashSaleModel) => m.item_id === item.item_id);
    return { ...item, models: itemModels.length > 0 ? itemModels : undefined };
  });

  // Chỉ lấy items enabled
  const enabledItems = itemsWithModels.filter((item: FlashSaleItem) => item.status === 1);
  console.log(`[SCHEDULER][parseItems] Enabled items: ${enabledItems.length}/${itemInfoList.length}`);

  // Convert sang format để add vào FS mới
  const items: Array<Record<string, unknown>> = [];
  for (const item of enabledItems) {
    const enabledModels = (item as FlashSaleItem).models?.filter(m => m.status === 1) || [];
    const isNonVariantWithModel = enabledModels.length === 1 && enabledModels[0].model_id === 0;

    if (isNonVariantWithModel) {
      const model = enabledModels[0];
      if (!model.input_promotion_price || model.input_promotion_price <= 0) continue;
      items.push({
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        item_input_promo_price: model.input_promotion_price,
        item_stock: Math.max(model.campaign_stock || 1, 1), // Minimum 1 - Shopee rejects 0
      });
      continue;
    }

    if (enabledModels.length === 0 && item.input_promotion_price && item.input_promotion_price > 0) {
      items.push({
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        item_input_promo_price: item.input_promotion_price,
        item_stock: Math.max(item.campaign_stock || 1, 1), // Minimum 1 - Shopee rejects 0
      });
      continue;
    }

    if (enabledModels.length === 0) continue;

    const modelData = enabledModels.map(m => ({
      model_id: m.model_id,
      input_promo_price: m.input_promotion_price || 0,
      stock: Math.max(m.campaign_stock || 1, 1), // Minimum 1 - Shopee rejects 0
    }));
    if (modelData.length > 0 && modelData.every(m => m.input_promo_price > 0)) {
      items.push({
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        models: modelData,
      });
    }
  }

  console.log(`[SCHEDULER][parseItems] Final parsed items: ${items.length}`);
  if (items.length > 0) {
    console.log(`[SCHEDULER][parseItems] Sample item:`, JSON.stringify(items[0]));
  }
  return items;
}

async function getTemplateItems(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  shopId: number,
  token: { access_token: string; refresh_token: string },
  callerUserId?: string,
  callerUserEmail?: string,
  triggeredBy?: string
): Promise<Array<Record<string, unknown>>> {
  // Lấy Flash Sale candidates từ DB - CHỈ upcoming (type=1) và đang chạy (type=2), bỏ qua đã kết thúc (type=3)
  const { data: fsCandidates } = await supabase
    .from('apishopee_flash_sale_data')
    .select('flash_sale_id, type, item_count')
    .eq('shop_id', shopId)
    .gt('item_count', 0)
    .in('type', [1, 2]) // Chỉ upcoming + running, KHÔNG lấy type=3 (ended) vì Shopee đã xóa
    .order('type', { ascending: true }) // type 1 (upcoming) trước, rồi 2 (running)
    .order('start_time', { ascending: false })
    .limit(5);

  const candidates = fsCandidates || [];

  if (candidates.length === 0) {
    console.log('[SCHEDULER] No template flash sale found in DB');
  }

  // Thử từng template FS cho đến khi lấy được items
  for (const fs of candidates) {
    console.log(`[SCHEDULER] Trying template FS ${fs.flash_sale_id} (type ${fs.type}, ${fs.item_count} items)`);

    const result = await callShopeeAPI(
      supabase,
      credentials,
      '/api/v2/shop_flash_sale/get_shop_flash_sale_items',
      'GET',
      shopId,
      token,
      undefined,
      { flash_sale_id: fs.flash_sale_id, offset: 0, limit: 100 },
      callerUserId,
      callerUserEmail,
      triggeredBy
    ) as { response?: { item_info?: FlashSaleItem[]; models?: FlashSaleModel[] }; error?: string; message?: string };

    // FS không còn tồn tại trên Shopee → skip candidate này, thử tiếp
    if (result.error === 'shop_flash_sale_not_exist' || result.error === 'shop_flash_sale_is_not_enabled_or_upcoming') {
      console.log(`[SCHEDULER] FS ${fs.flash_sale_id} no longer exists on Shopee (${result.error}), trying next candidate`);
      continue;
    }

    const items = parseFlashSaleItems(result);

    if (items.length > 0) {
      console.log(`[SCHEDULER] Got ${items.length} items from FS ${fs.flash_sale_id}`);
      return items;
    }

    console.log(`[SCHEDULER] FS ${fs.flash_sale_id} returned 0 valid items, trying next...`);
  }

  // Fallback 1: lấy từ history thành công
  console.log('[SCHEDULER] No items from any template FS, trying fallback from successful history');
  const historyItems = await getItemsFromSuccessfulHistory(supabase, shopId);
  if (historyItems.length > 0) {
    return historyItems;
  }

  // Fallback 2: gọi trực tiếp Shopee API lấy FS list live, rồi lấy items từ FS đang upcoming/running
  console.log('[SCHEDULER] No history items, trying live Shopee API fallback');
  const liveResult = await callShopeeAPI(
    supabase, credentials,
    '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
    'GET', shopId, token, undefined,
    { type: 0, offset: 0, limit: 50 },
    callerUserId, callerUserEmail, triggeredBy
  ) as { response?: { flash_sale_list?: Array<{ flash_sale_id: number; type: number; item_count: number }> } };

  const liveList = (liveResult?.response?.flash_sale_list || [])
    .filter(fs => (fs.type === 1 || fs.type === 2) && fs.item_count > 0)
    .sort((a, b) => a.type - b.type); // upcoming (1) first

  for (const fs of liveList) {
    console.log(`[SCHEDULER] Live fallback: trying FS ${fs.flash_sale_id} (type ${fs.type}, ${fs.item_count} items)`);
    const itemResult = await callShopeeAPI(
      supabase, credentials,
      '/api/v2/shop_flash_sale/get_shop_flash_sale_items',
      'GET', shopId, token, undefined,
      { flash_sale_id: fs.flash_sale_id, offset: 0, limit: 100 },
      callerUserId, callerUserEmail, triggeredBy
    ) as { response?: { item_info?: FlashSaleItem[]; models?: FlashSaleModel[] }; error?: string; message?: string };

    if (itemResult.error) {
      console.log(`[SCHEDULER] Live fallback: FS ${fs.flash_sale_id} error: ${itemResult.error}, trying next`);
      continue;
    }

    const items = parseFlashSaleItems(itemResult);
    if (items.length > 0) {
      console.log(`[SCHEDULER] Live fallback: got ${items.length} items from FS ${fs.flash_sale_id}`);
      return items;
    }
  }

  console.log(`[SCHEDULER][getTemplateItems] ALL FALLBACKS FAILED - No items found for shop ${shopId}`);
  return [];
}

/**
 * Lấy items từ lần tạo FS thành công gần nhất trong history
 * Fallback khi không thể lấy items từ Shopee API
 */
async function getItemsFromSuccessfulHistory(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<Array<Record<string, unknown>>> {
  console.log(`[SCHEDULER] Trying to get items from successful history for shop ${shopId}`);

  const { data: successHistory } = await supabase
    .from('apishopee_flash_sale_auto_history')
    .select('id, flash_sale_id, items_data, items_count, executed_at')
    .eq('shop_id', shopId)
    .eq('status', 'success')
    .not('items_data', 'is', null)
    .order('executed_at', { ascending: false })
    .limit(1)
    .single();

  if (successHistory?.items_data && Array.isArray(successHistory.items_data) && successHistory.items_data.length > 0) {
    console.log(`[SCHEDULER] Found ${successHistory.items_data.length} items from history (FS #${successHistory.flash_sale_id}, executed ${successHistory.executed_at})`);
    return successHistory.items_data as Array<Record<string, unknown>>;
  }

  console.log('[SCHEDULER] No items found in successful history');
  return [];
}

/**
 * Xử lý một scheduled job
 */
async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: ScheduledJob,
  callerUserId?: string,
  callerUserEmail?: string,
  triggeredBy?: string
): Promise<{ success: boolean; message: string; flashSaleId?: number }> {
  console.log(`[SCHEDULER] Processing job ${job.id} for shop ${job.shop_id}, timeslot ${job.timeslot_id}`);

  try {
    // Chỉ skip khi slot đã KẾT THÚC - nếu slot đang chạy vẫn thử tạo FS
    const nowUnix = Math.floor(Date.now() / 1000);

    if (job.slot_end_time && nowUnix >= job.slot_end_time) {
      const errorMsg = `Khung giờ đã kết thúc (${new Date(job.slot_end_time * 1000).toLocaleString('vi-VN')})`;
      console.log(`[SCHEDULER] ${errorMsg}`);

      await supabase
        .from('apishopee_flash_sale_auto_history')
        .update({
          status: 'error',
          error_message: errorMsg,
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return { success: false, message: errorMsg };
    }

    // Update status to processing
    await supabase
      .from('apishopee_flash_sale_auto_history')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    const credentials = await getPartnerCredentials(supabase, job.shop_id);
    const token = await getTokenWithAutoRefresh(supabase, job.shop_id);

    // 1. Kiểm tra xem timeslot đã có Flash Sale chưa
    const { exists, flashSaleId: existingFsId } = await checkTimeslotHasFlashSale(
      supabase, credentials, job.shop_id, token, job.timeslot_id, callerUserId, callerUserEmail, triggeredBy
    );

    if (exists) {
      // Slot đã có FS (có thể tạo thủ công trên Shopee)
      const errorMsg = `Khung giờ đã có Flash Sale #${existingFsId} (có thể được tạo thủ công trên Shopee)`;
      console.log(`[SCHEDULER] ${errorMsg}`);
      
      await supabase
        .from('apishopee_flash_sale_auto_history')
        .update({
          status: 'error',
          error_message: errorMsg,
          flash_sale_id: existingFsId, // Lưu lại FS ID đã tồn tại
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return { success: false, message: errorMsg, flashSaleId: existingFsId };
    }

    // 2. Lấy template items - ưu tiên từ job.items_data nếu có
    let itemsToAdd: Array<Record<string, unknown>> = [];

    if (job.items_data && Array.isArray(job.items_data) && job.items_data.length > 0) {
      console.log(`[SCHEDULER] Using ${job.items_data.length} items from job.items_data`);
      itemsToAdd = job.items_data as Array<Record<string, unknown>>;
    } else {
      console.log('[SCHEDULER] No items_data in job, fetching from template sources...');
      itemsToAdd = await getTemplateItems(supabase, credentials, job.shop_id, token, callerUserId, callerUserEmail, triggeredBy);
    }

    if (itemsToAdd.length === 0) {
      const errorMsg = 'Không có sản phẩm mẫu để thêm vào Flash Sale';
      await supabase
        .from('apishopee_flash_sale_auto_history')
        .update({
          status: 'error',
          error_message: errorMsg,
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return { success: false, message: errorMsg };
    }

    // 3. Tạo Flash Sale mới
    const createResult = await callShopeeAPI(
      supabase,
      credentials,
      '/api/v2/shop_flash_sale/create_shop_flash_sale',
      'POST',
      job.shop_id,
      token,
      { timeslot_id: job.timeslot_id },
      undefined,
      callerUserId,
      callerUserEmail,
      triggeredBy
    ) as { response?: { flash_sale_id?: number }; error?: string; message?: string };

    if (createResult.error || !createResult.response?.flash_sale_id) {
      const errorMsg = createResult.message || createResult.error || 'Không thể tạo Flash Sale';
      const currentRetryCount = job.retry_count || 0;
      const canRetry = isTransientError(errorMsg) && currentRetryCount < MAX_RETRY_COUNT;

      if (canRetry) {
        const retryDelayMin = getRetryDelayMinutes(currentRetryCount);
        const retryAt = new Date(Date.now() + retryDelayMin * 60 * 1000).toISOString();
        console.log(`[SCHEDULER] Job ${job.id} (create FS) scheduled for retry #${currentRetryCount + 1} at ${retryAt}`);

        await supabase
          .from('apishopee_flash_sale_auto_history')
          .update({
            status: 'retry',
            retry_count: currentRetryCount + 1,
            scheduled_at: retryAt,
            error_message: `Retry ${currentRetryCount + 1}/${MAX_RETRY_COUNT}: ${errorMsg}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        return { success: false, message: `Scheduled for retry: ${errorMsg}` };
      }

      await supabase
        .from('apishopee_flash_sale_auto_history')
        .update({
          status: 'error',
          error_message: errorMsg,
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      await sendFailureAlert(job, errorMsg);
      return { success: false, message: errorMsg };
    }

    const newFlashSaleId = createResult.response.flash_sale_id;
    console.log(`[SCHEDULER] Created Flash Sale #${newFlashSaleId}`);

    // 4. Thêm sản phẩm vào Flash Sale
    console.log(`[SCHEDULER] Adding ${itemsToAdd.length} items to FS #${newFlashSaleId}`);
    console.log(`[SCHEDULER] Items payload:`, JSON.stringify(itemsToAdd.slice(0, 3))); // Log first 3 items

    const addResult = await callShopeeAPI(
      supabase,
      credentials,
      '/api/v2/shop_flash_sale/add_shop_flash_sale_items',
      'POST',
      job.shop_id,
      token,
      { flash_sale_id: newFlashSaleId, items: itemsToAdd },
      undefined,
      callerUserId,
      callerUserEmail,
      triggeredBy
    ) as { error?: string; message?: string; response?: {
      success_list?: unknown[]; fail_list?: unknown[];
      failed_items?: Array<{ item_id: number; model_id?: number; err_code?: number; err_msg?: string }>;
    } };

    console.log(`[SCHEDULER] Add items response:`, JSON.stringify(addResult));

    let message = `Đã tạo Flash Sale #${newFlashSaleId}`;
    let finalStatus: 'success' | 'partial' | 'error' = 'success';
    let addedItemsCount = itemsToAdd.length;

    // Shopee API returns non-empty error string on failure
    if (addResult.error && addResult.error !== '') {
      const addErrorMsg = addResult.message || addResult.error;
      message += ` (Lỗi thêm SP: ${addErrorMsg})`;
      finalStatus = 'partial';
      addedItemsCount = 0;
      console.error(`[SCHEDULER] Add items failed for FS #${newFlashSaleId}:`, addErrorMsg);
    } else {
      // Shopee API uses "failed_items" (not "fail_list") for per-item/model errors
      const failedItems = addResult.response?.failed_items || [];
      // Also check legacy field names for backward compatibility
      const successList = addResult.response?.success_list || [];
      const failList = addResult.response?.fail_list || [];

      if (failedItems.length > 0) {
        // failed_items contains per-model failures, not per-item
        // Items can still be partially added even with some model failures
        const failedItemIds = [...new Set(failedItems.map(f => f.item_id))];
        console.error(`[SCHEDULER] ${failedItems.length} model(s) in ${failedItemIds.length} item(s) FAILED for FS #${newFlashSaleId}:`, JSON.stringify(failedItems.slice(0, 10)));

        // If all submitted items have failures, mark as partial; otherwise success with warning
        if (failedItemIds.length >= itemsToAdd.length) {
          finalStatus = 'partial';
          addedItemsCount = 0;
        } else {
          finalStatus = 'success';
          addedItemsCount = itemsToAdd.length - failedItemIds.length;
        }

        const failReasons = failedItems.slice(0, 5).map(f => `item ${f.item_id} model ${f.model_id || 0}: ${f.err_msg || 'unknown'}`).join('; ');
        message = `FS #${newFlashSaleId}: ${addedItemsCount}/${itemsToAdd.length} items OK (${failedItems.length} model failures: ${failReasons})`;
      } else if (failList.length > 0) {
        // Legacy fail_list handling
        const failedCount = failList.length;
        const successCount = successList.length;
        addedItemsCount = successCount;
        finalStatus = successCount === 0 ? 'error' : 'partial';
        message = `FS #${newFlashSaleId}: ${successCount}/${itemsToAdd.length} items added (${failedCount} failed)`;
      } else {
        // No failures - all items added successfully
        // Shopee may return empty response object on full success
        addedItemsCount = successList.length > 0 ? successList.length : itemsToAdd.length;
        finalStatus = 'success';
        message = `Đã tạo Flash Sale #${newFlashSaleId} với ${addedItemsCount} sản phẩm`;
      }
    }

    // 5. Update status based on result
    await supabase
      .from('apishopee_flash_sale_auto_history')
      .update({
        status: finalStatus,
        flash_sale_id: newFlashSaleId,
        items_count: addedItemsCount,
        items_data: itemsToAdd, // Lưu items để fallback cho lần sau
        error_message: finalStatus !== 'success' ? message : null,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`[SCHEDULER] Job ${job.id} completed (${finalStatus}): ${message}`);

    // Send alert for partial/error failures (items rejected by Shopee)
    if (finalStatus === 'partial' || finalStatus === 'error') {
      await sendFailureAlert(job, message);
    }

    return { success: finalStatus === 'success', message, flashSaleId: newFlashSaleId };

  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`[SCHEDULER] Job ${job.id} failed:`, errorMsg);

    const currentRetryCount = job.retry_count || 0;
    const canRetry = isTransientError(errorMsg) && currentRetryCount < MAX_RETRY_COUNT;

    if (canRetry) {
      // Schedule for retry
      const retryDelayMin = getRetryDelayMinutes(currentRetryCount);
      const retryAt = new Date(Date.now() + retryDelayMin * 60 * 1000).toISOString();
      console.log(`[SCHEDULER] Job ${job.id} scheduled for retry #${currentRetryCount + 1} at ${retryAt}`);

      await supabase
        .from('apishopee_flash_sale_auto_history')
        .update({
          status: 'retry',
          retry_count: currentRetryCount + 1,
          scheduled_at: retryAt,
          error_message: `Retry ${currentRetryCount + 1}/${MAX_RETRY_COUNT}: ${errorMsg}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return { success: false, message: `Scheduled for retry: ${errorMsg}` };
    }

    // Permanent failure - mark as error and send alert
    await supabase
      .from('apishopee_flash_sale_auto_history')
      .update({
        status: 'error',
        error_message: errorMsg,
        executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Send alert for permanent failure
    await sendFailureAlert(job, errorMsg);

    return { success: false, message: errorMsg };
  }
}

/**
 * Sync flash sale list từ Shopee vào apishopee_flash_sale_data
 * Gọi sau khi tạo FS thành công để trang /flash-sale hiển thị dữ liệu mới
 */
async function syncFlashSaleData(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  shopId: number,
  token: { access_token: string; refresh_token: string },
  userId: string,
  callerUserId?: string,
  callerUserEmail?: string,
  triggeredBy?: string
): Promise<number> {
  console.log(`[SCHEDULER] Syncing flash sale data for shop ${shopId}`);

  const result = await callShopeeAPI(
    supabase,
    credentials,
    '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
    'GET',
    shopId,
    token,
    undefined,
    { type: 0, offset: 0, limit: 50 },
    callerUserId,
    callerUserEmail,
    triggeredBy
  ) as { response?: { flash_sale_list?: Array<Record<string, unknown>>; total_count?: number }; error?: string };

  if (result.error || !result.response?.flash_sale_list) {
    console.error(`[SCHEDULER] Sync failed for shop ${shopId}:`, result.error);
    return 0;
  }

  const flashSaleList = result.response.flash_sale_list;
  const syncedAt = new Date().toISOString();

  const upsertData = flashSaleList.map(sale => ({
    shop_id: shopId,
    user_id: null,
    synced_by: userId,
    flash_sale_id: sale.flash_sale_id,
    timeslot_id: sale.timeslot_id,
    status: sale.status,
    start_time: sale.start_time,
    end_time: sale.end_time,
    enabled_item_count: sale.enabled_item_count || 0,
    item_count: sale.item_count || 0,
    type: sale.type,
    remindme_count: sale.remindme_count || 0,
    click_count: sale.click_count || 0,
    raw_response: sale,
    synced_at: syncedAt,
  }));

  const { error: upsertError } = await supabase
    .from('apishopee_flash_sale_data')
    .upsert(upsertData, { onConflict: 'shop_id,flash_sale_id' });

  if (upsertError) {
    console.error(`[SCHEDULER] Upsert error for shop ${shopId}:`, upsertError);
    return 0;
  }

  // Update sync status
  await supabase
    .from('apishopee_sync_status')
    .upsert({
      shop_id: shopId,
      user_id: userId,
      flash_sales_synced_at: syncedAt,
      updated_at: syncedAt,
    }, { onConflict: 'shop_id,user_id' });

  console.log(`[SCHEDULER] Synced ${flashSaleList.length} flash sales for shop ${shopId}`);
  return flashSaleList.length;
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();

    // Extract calling user from JWT (decode only, already verified by gateway)
    const { userId: callerUserId, userEmail: callerUserEmail } = extractUserFromJwt(req.headers.get('Authorization'));
    const triggeredBy = determineTriggeredBy({ userId: callerUserId, userEmail: callerUserEmail }, 'scheduler');

    console.log(`[SCHEDULER] Running at ${now}`);

    // Tìm các scheduled + retry jobs đến hạn
    const { data: pendingJobs, error: queryError } = await supabase
      .from('apishopee_flash_sale_auto_history')
      .select('*')
      .in('status', ['scheduled', 'retry'])
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(200); // Xử lý tối đa 200 jobs mỗi lần

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[SCHEDULER] No pending jobs found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending jobs',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SCHEDULER] Found ${pendingJobs.length} pending jobs`);

    // Optimistic lock: đánh dấu processing ngay để tránh duplicate nếu scheduler chạy chồng
    const jobIds = pendingJobs.map((j: { id: string }) => j.id);
    const { error: lockError } = await supabase
      .from('apishopee_flash_sale_auto_history')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .in('id', jobIds);

    if (lockError) {
      console.error(`[SCHEDULER] Failed to lock jobs:`, lockError.message);
    }

    // Nhóm jobs theo shop_id để xử lý song song giữa các shop
    const jobsByShop = new Map<number, typeof pendingJobs>();
    for (const job of pendingJobs) {
      const shopId = job.shop_id as number;
      if (!jobsByShop.has(shopId)) {
        jobsByShop.set(shopId, []);
      }
      jobsByShop.get(shopId)!.push(job);
    }

    console.log(`[SCHEDULER] ${pendingJobs.length} jobs across ${jobsByShop.size} shops`);

    // Xử lý các shop song song (giới hạn 5 shop/batch để tránh Shopee rate limit khi dùng chung partner_id)
    const MAX_CONCURRENT_SHOPS = 5;
    const shopEntries = Array.from(jobsByShop.entries());
    const results: Array<{ jobId: string; shopId: number; timeslotId: number; success: boolean; message: string; flashSaleId?: number }> = [];

    for (let i = 0; i < shopEntries.length; i += MAX_CONCURRENT_SHOPS) {
      const batch = shopEntries.slice(i, i + MAX_CONCURRENT_SHOPS);

      const batchResults = await Promise.allSettled(
        batch.map(async ([shopId, jobs]) => {
          const shopResults = [];
          // Trong cùng 1 shop, xử lý tuần tự để tránh Shopee rate limit
          for (const job of jobs) {
            const result = await processJob(supabase, job as ScheduledJob, callerUserId, callerUserEmail, triggeredBy);
            shopResults.push({
              jobId: job.id as string,
              shopId,
              timeslotId: job.timeslot_id as number,
              ...result,
            });
            // Delay giữa các jobs cùng shop
            if (jobs.length > 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          return shopResults;
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        }
      }

      // Delay giữa các batch để tránh Shopee rate limit (tất cả shop chung 1 partner_id)
      if (i + MAX_CONCURRENT_SHOPS < shopEntries.length) {
        console.log(`[SCHEDULER] Batch delay: waiting 2s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`[SCHEDULER] Completed: ${successCount} success, ${errorCount} errors`);

    // Sync flash sale data cho các shop có tạo FS thành công
    if (successCount > 0) {
      const successShopIds = [...new Set(results.filter(r => r.success).map(r => r.shopId))];
      console.log(`[SCHEDULER] Syncing flash sale data for ${successShopIds.length} shops`);

      for (const shopId of successShopIds) {
        try {
          const credentials = await getPartnerCredentials(supabase, shopId);
          const token = await getTokenWithAutoRefresh(supabase, shopId);
          const job = pendingJobs.find(j => j.shop_id === shopId);
          const userId = (job?.user_id as string) || '';
          await syncFlashSaleData(supabase, credentials, shopId, token, userId, callerUserId, callerUserEmail, triggeredBy);
        } catch (err) {
          console.error(`[SCHEDULER] Sync failed for shop ${shopId}:`, (err as Error).message);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.length} jobs`,
      processed: results.length,
      successCount,
      errorCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SCHEDULER] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
