/**
 * Supabase Edge Function: Shopee Product Webhook & History Logger
 *
 * Xử lý:
 * 1. Webhook từ Shopee (real-time push notifications)
 * 2. Tạo log lịch sử biến đổi sản phẩm
 * 3. Phân tích và phát hiện bất thường
 *
 * Webhook Types từ Shopee:
 * - violation_item_push: Sản phẩm vi phạm chính sách
 * - item_price_update_push: Thay đổi giá sản phẩm
 * - item_stock_update_push: Thay đổi tồn kho
 * - item_status_change_push: Thay đổi trạng thái (NORMAL, UNLIST, BANNED)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ==================== INTERFACES ====================

interface WebhookPayload {
  code: number;
  shop_id: number;
  timestamp: number;
  data?: unknown;
}

interface ViolationItemPush {
  item_id: number;
  violation_type: string;
  violation_reason?: string;
  suggestion?: string;
}

interface PriceUpdatePush {
  item_id: number;
  model_id?: number;
  original_price: number;
  current_price: number;
  promotion_price?: number;
}

interface StockUpdatePush {
  item_id: number;
  model_id?: number;
  old_stock: number;
  new_stock: number;
}

interface StatusChangePush {
  item_id: number;
  old_status: string;
  new_status: string;
  reason?: string;
}

interface HistoryLogInput {
  shop_id: number;
  user_id: string;
  item_id: number;
  item_name?: string;
  model_id?: number;
  model_name?: string;
  change_type: 'price_change' | 'stock_change' | 'status_change' | 'content_change' | 'violation' | 'product_created' | 'product_deleted' | 'model_change';
  severity?: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  source: 'webhook' | 'api_sync' | 'manual_check';
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  change_summary: string;
  change_details?: Record<string, unknown>;
  violation_type?: string;
  violation_reason?: string;
  violation_suggestion?: string;
  shopee_timestamp?: number;
  raw_webhook_payload?: unknown;
  raw_api_response?: unknown;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Lấy user_id từ shop_id (lấy user đầu tiên là member của shop)
 */
async function getUserIdFromShopId(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<string | null> {
  const { data } = await supabase
    .from('apishopee_shops')
    .select('id')
    .eq('shop_id', shopId)
    .single();

  if (!data) return null;

  const { data: member } = await supabase
    .from('apishopee_shop_members')
    .select('profile_id')
    .eq('shop_id', data.id)
    .limit(1)
    .single();

  return member?.profile_id || null;
}

/**
 * Lấy thông tin sản phẩm từ database
 */
async function getProductInfo(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  itemId: number
): Promise<{ item_name: string; current_price: number; total_available_stock: number; item_status: string } | null> {
  const { data } = await supabase
    .from('apishopee_products')
    .select('item_name, current_price, total_available_stock, item_status')
    .eq('shop_id', shopId)
    .eq('item_id', itemId)
    .single();

  return data;
}

/**
 * Lấy thông tin model từ database
 */
async function getModelInfo(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  itemId: number,
  modelId: number
): Promise<{ model_name: string; current_price: number; total_available_stock: number } | null> {
  const { data } = await supabase
    .from('apishopee_product_models')
    .select('model_name, current_price, total_available_stock')
    .eq('shop_id', shopId)
    .eq('item_id', itemId)
    .eq('model_id', modelId)
    .single();

  return data;
}

/**
 * Tạo log lịch sử
 */
async function createHistoryLog(
  supabase: ReturnType<typeof createClient>,
  input: HistoryLogInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('apishopee_product_history_logs')
    .insert({
      shop_id: input.shop_id,
      user_id: input.user_id,
      item_id: input.item_id,
      item_name: input.item_name,
      model_id: input.model_id,
      model_name: input.model_name,
      change_type: input.change_type,
      severity: input.severity || 'INFO',
      source: input.source,
      old_value: input.old_value,
      new_value: input.new_value,
      change_summary: input.change_summary,
      change_details: input.change_details,
      violation_type: input.violation_type,
      violation_reason: input.violation_reason,
      violation_suggestion: input.violation_suggestion,
      shopee_timestamp: input.shopee_timestamp,
      raw_webhook_payload: input.raw_webhook_payload,
      raw_api_response: input.raw_api_response,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[HISTORY] Insert error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}

/**
 * Format giá tiền VND
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

/**
 * Tính phần trăm thay đổi
 */
function calculateChangePercent(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Math.round(((newValue - oldValue) / oldValue) * 100);
}

// ==================== WEBHOOK HANDLERS ====================

/**
 * Xử lý webhook vi phạm sản phẩm
 */
async function handleViolationPush(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  data: ViolationItemPush,
  timestamp: number,
  rawPayload: unknown
): Promise<{ success: boolean; error?: string }> {
  console.log('[WEBHOOK] Processing violation_item_push for item:', data.item_id);

  const productInfo = await getProductInfo(supabase, shopId, data.item_id);

  const result = await createHistoryLog(supabase, {
    shop_id: shopId,
    user_id: userId,
    item_id: data.item_id,
    item_name: productInfo?.item_name,
    change_type: 'violation',
    severity: 'HIGH',
    source: 'webhook',
    old_value: productInfo ? { item_status: productInfo.item_status } : undefined,
    new_value: { violation_type: data.violation_type },
    change_summary: `Vi phạm: ${data.violation_type}`,
    change_details: {
      violation_type: data.violation_type,
      reason: data.violation_reason,
      suggestion: data.suggestion,
    },
    violation_type: data.violation_type,
    violation_reason: data.violation_reason,
    violation_suggestion: data.suggestion,
    shopee_timestamp: timestamp,
    raw_webhook_payload: rawPayload,
  });

  return result;
}

/**
 * Xử lý webhook thay đổi giá
 */
async function handlePriceUpdatePush(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  data: PriceUpdatePush,
  timestamp: number,
  rawPayload: unknown
): Promise<{ success: boolean; error?: string }> {
  console.log('[WEBHOOK] Processing item_price_update_push for item:', data.item_id);

  const productInfo = await getProductInfo(supabase, shopId, data.item_id);
  let modelInfo = null;

  if (data.model_id) {
    modelInfo = await getModelInfo(supabase, shopId, data.item_id, data.model_id);
  }

  const oldPrice = modelInfo?.current_price || productInfo?.current_price || 0;
  const newPrice = data.current_price;
  const changePercent = calculateChangePercent(oldPrice, newPrice);

  let changeSummary = '';
  if (data.model_id && modelInfo) {
    changeSummary = `${modelInfo.model_name}: ${formatPrice(oldPrice)} → ${formatPrice(newPrice)} (${changePercent > 0 ? '+' : ''}${changePercent}%)`;
  } else {
    changeSummary = `Giá: ${formatPrice(oldPrice)} → ${formatPrice(newPrice)} (${changePercent > 0 ? '+' : ''}${changePercent}%)`;
  }

  const result = await createHistoryLog(supabase, {
    shop_id: shopId,
    user_id: userId,
    item_id: data.item_id,
    item_name: productInfo?.item_name,
    model_id: data.model_id,
    model_name: modelInfo?.model_name,
    change_type: 'price_change',
    source: 'webhook',
    old_value: {
      current_price: oldPrice,
      original_price: data.original_price,
    },
    new_value: {
      current_price: newPrice,
      original_price: data.original_price,
      promotion_price: data.promotion_price,
    },
    change_summary: changeSummary,
    change_details: {
      old_price: oldPrice,
      new_price: newPrice,
      change_percent: changePercent,
      promotion_price: data.promotion_price,
    },
    shopee_timestamp: timestamp,
    raw_webhook_payload: rawPayload,
  });

  return result;
}

/**
 * Xử lý webhook thay đổi tồn kho
 */
async function handleStockUpdatePush(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  data: StockUpdatePush,
  timestamp: number,
  rawPayload: unknown
): Promise<{ success: boolean; error?: string }> {
  console.log('[WEBHOOK] Processing item_stock_update_push for item:', data.item_id);

  const productInfo = await getProductInfo(supabase, shopId, data.item_id);
  let modelInfo = null;

  if (data.model_id) {
    modelInfo = await getModelInfo(supabase, shopId, data.item_id, data.model_id);
  }

  const stockDiff = data.new_stock - data.old_stock;

  let changeSummary = '';
  if (data.model_id && modelInfo) {
    changeSummary = `${modelInfo.model_name}: Kho ${data.old_stock} → ${data.new_stock} (${stockDiff > 0 ? '+' : ''}${stockDiff})`;
  } else {
    changeSummary = `Kho: ${data.old_stock} → ${data.new_stock} (${stockDiff > 0 ? '+' : ''}${stockDiff})`;
  }

  const result = await createHistoryLog(supabase, {
    shop_id: shopId,
    user_id: userId,
    item_id: data.item_id,
    item_name: productInfo?.item_name,
    model_id: data.model_id,
    model_name: modelInfo?.model_name,
    change_type: 'stock_change',
    source: 'webhook',
    old_value: {
      total_available_stock: data.old_stock,
    },
    new_value: {
      total_available_stock: data.new_stock,
    },
    change_summary: changeSummary,
    change_details: {
      old_stock: data.old_stock,
      new_stock: data.new_stock,
      stock_diff: stockDiff,
    },
    shopee_timestamp: timestamp,
    raw_webhook_payload: rawPayload,
  });

  return result;
}

/**
 * Xử lý webhook thay đổi trạng thái
 */
async function handleStatusChangePush(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  data: StatusChangePush,
  timestamp: number,
  rawPayload: unknown
): Promise<{ success: boolean; error?: string }> {
  console.log('[WEBHOOK] Processing item_status_change_push for item:', data.item_id);

  const productInfo = await getProductInfo(supabase, shopId, data.item_id);

  const statusLabels: Record<string, string> = {
    'NORMAL': 'Hoạt động',
    'UNLIST': 'Đã ẩn',
    'BANNED': 'Vi phạm',
  };

  const changeSummary = `Trạng thái: ${statusLabels[data.old_status] || data.old_status} → ${statusLabels[data.new_status] || data.new_status}`;

  // Nếu chuyển sang BANNED thì severity cao
  const severity = data.new_status === 'BANNED' ? 'HIGH' : 'INFO';

  const result = await createHistoryLog(supabase, {
    shop_id: shopId,
    user_id: userId,
    item_id: data.item_id,
    item_name: productInfo?.item_name,
    change_type: 'status_change',
    severity: severity,
    source: 'webhook',
    old_value: {
      item_status: data.old_status,
    },
    new_value: {
      item_status: data.new_status,
    },
    change_summary: changeSummary,
    change_details: {
      old_status: data.old_status,
      new_status: data.new_status,
      reason: data.reason,
    },
    shopee_timestamp: timestamp,
    raw_webhook_payload: rawPayload,
  });

  return result;
}

// ==================== API SYNC DIFF HANDLERS ====================

/**
 * So sánh và tạo log cho sự thay đổi từ API sync
 * Được gọi từ apishopee-product khi phát hiện sự khác biệt
 */
interface DiffInput {
  shop_id: number;
  user_id: string;
  item_id: number;
  item_name: string;
  old_data: {
    current_price?: number;
    original_price?: number;
    total_available_stock?: number;
    item_status?: string;
    item_name?: string;
  };
  new_data: {
    current_price?: number;
    original_price?: number;
    total_available_stock?: number;
    item_status?: string;
    item_name?: string;
  };
  shopee_timestamp?: number;
  raw_response?: unknown;
}

async function processProductDiff(
  supabase: ReturnType<typeof createClient>,
  input: DiffInput
): Promise<{ logs_created: number; errors: string[] }> {
  const logs: HistoryLogInput[] = [];
  const errors: string[] = [];

  const { shop_id, user_id, item_id, item_name, old_data, new_data, shopee_timestamp, raw_response } = input;

  // Check giá thay đổi
  if (old_data.current_price !== new_data.current_price && new_data.current_price !== undefined) {
    const changePercent = calculateChangePercent(old_data.current_price || 0, new_data.current_price);
    logs.push({
      shop_id,
      user_id,
      item_id,
      item_name,
      change_type: 'price_change',
      source: 'api_sync',
      old_value: { current_price: old_data.current_price, original_price: old_data.original_price },
      new_value: { current_price: new_data.current_price, original_price: new_data.original_price },
      change_summary: `Giá: ${formatPrice(old_data.current_price || 0)} → ${formatPrice(new_data.current_price)} (${changePercent > 0 ? '+' : ''}${changePercent}%)`,
      change_details: { change_percent: changePercent },
      shopee_timestamp,
      raw_api_response: raw_response,
    });
  }

  // Check tồn kho thay đổi
  if (old_data.total_available_stock !== new_data.total_available_stock && new_data.total_available_stock !== undefined) {
    const stockDiff = (new_data.total_available_stock || 0) - (old_data.total_available_stock || 0);
    logs.push({
      shop_id,
      user_id,
      item_id,
      item_name,
      change_type: 'stock_change',
      source: 'api_sync',
      old_value: { total_available_stock: old_data.total_available_stock },
      new_value: { total_available_stock: new_data.total_available_stock },
      change_summary: `Kho: ${old_data.total_available_stock || 0} → ${new_data.total_available_stock} (${stockDiff > 0 ? '+' : ''}${stockDiff})`,
      change_details: { stock_diff: stockDiff },
      shopee_timestamp,
      raw_api_response: raw_response,
    });
  }

  // Check trạng thái thay đổi
  if (old_data.item_status !== new_data.item_status && new_data.item_status !== undefined) {
    const statusLabels: Record<string, string> = {
      'NORMAL': 'Hoạt động',
      'UNLIST': 'Đã ẩn',
      'BANNED': 'Vi phạm',
    };
    logs.push({
      shop_id,
      user_id,
      item_id,
      item_name,
      change_type: 'status_change',
      severity: new_data.item_status === 'BANNED' ? 'HIGH' : 'INFO',
      source: 'api_sync',
      old_value: { item_status: old_data.item_status },
      new_value: { item_status: new_data.item_status },
      change_summary: `Trạng thái: ${statusLabels[old_data.item_status || ''] || old_data.item_status} → ${statusLabels[new_data.item_status] || new_data.item_status}`,
      shopee_timestamp,
      raw_api_response: raw_response,
    });
  }

  // Check tên sản phẩm thay đổi
  if (old_data.item_name !== new_data.item_name && new_data.item_name !== undefined && old_data.item_name !== undefined) {
    logs.push({
      shop_id,
      user_id,
      item_id,
      item_name: new_data.item_name,
      change_type: 'content_change',
      source: 'api_sync',
      old_value: { item_name: old_data.item_name },
      new_value: { item_name: new_data.item_name },
      change_summary: `Đổi tên sản phẩm`,
      change_details: {
        old_name: old_data.item_name,
        new_name: new_data.item_name,
      },
      shopee_timestamp,
      raw_api_response: raw_response,
    });
  }

  // Insert all logs
  for (const log of logs) {
    const result = await createHistoryLog(supabase, log);
    if (!result.success) {
      errors.push(result.error || 'Unknown error');
    }
  }

  return { logs_created: logs.length - errors.length, errors };
}

/**
 * Tạo log cho sản phẩm mới được phát hiện
 */
async function logProductCreated(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  itemId: number,
  itemName: string,
  currentPrice: number,
  totalStock: number,
  shopeeTimestamp?: number,
  rawResponse?: unknown
): Promise<{ success: boolean; error?: string }> {
  return await createHistoryLog(supabase, {
    shop_id: shopId,
    user_id: userId,
    item_id: itemId,
    item_name: itemName,
    change_type: 'product_created',
    source: 'api_sync',
    new_value: {
      item_name: itemName,
      current_price: currentPrice,
      total_available_stock: totalStock,
    },
    change_summary: `Sản phẩm mới: ${itemName.substring(0, 50)}${itemName.length > 50 ? '...' : ''}`,
    shopee_timestamp: shopeeTimestamp,
    raw_api_response: rawResponse,
  });
}

/**
 * Tạo log cho sản phẩm bị xóa
 */
async function logProductDeleted(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  userId: string,
  itemId: number,
  itemName?: string
): Promise<{ success: boolean; error?: string }> {
  return await createHistoryLog(supabase, {
    shop_id: shopId,
    user_id: userId,
    item_id: itemId,
    item_name: itemName,
    change_type: 'product_deleted',
    severity: 'WARNING',
    source: 'api_sync',
    old_value: { item_name: itemName },
    change_summary: `Sản phẩm đã bị xóa: ${itemName || `#${itemId}`}`,
  });
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ==================== WEBHOOK HANDLERS ====================
    if (action === 'webhook') {
      const { webhook_type, payload } = body as { webhook_type: string; payload: WebhookPayload };

      if (!payload?.shop_id) {
        return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userId = await getUserIdFromShopId(supabase, payload.shop_id);
      if (!userId) {
        console.log('[WEBHOOK] No user found for shop:', payload.shop_id);
        return new Response(JSON.stringify({ error: 'Shop not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let result;

      switch (webhook_type) {
        case 'violation_item_push':
          result = await handleViolationPush(
            supabase, payload.shop_id, userId,
            payload.data as ViolationItemPush,
            payload.timestamp, payload
          );
          break;

        case 'item_price_update_push':
          result = await handlePriceUpdatePush(
            supabase, payload.shop_id, userId,
            payload.data as PriceUpdatePush,
            payload.timestamp, payload
          );
          break;

        case 'item_stock_update_push':
          result = await handleStockUpdatePush(
            supabase, payload.shop_id, userId,
            payload.data as StockUpdatePush,
            payload.timestamp, payload
          );
          break;

        case 'item_status_change_push':
          result = await handleStatusChangePush(
            supabase, payload.shop_id, userId,
            payload.data as StatusChangePush,
            payload.timestamp, payload
          );
          break;

        default:
          console.log('[WEBHOOK] Unknown webhook type:', webhook_type);
          result = { success: false, error: `Unknown webhook type: ${webhook_type}` };
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== API SYNC DIFF HANDLERS ====================
    if (action === 'process-diff') {
      const { diffs } = body as { diffs: DiffInput[] };

      if (!diffs || !Array.isArray(diffs)) {
        return new Response(JSON.stringify({ error: 'diffs array is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let totalLogsCreated = 0;
      const allErrors: string[] = [];

      for (const diff of diffs) {
        const result = await processProductDiff(supabase, diff);
        totalLogsCreated += result.logs_created;
        allErrors.push(...result.errors);
      }

      return new Response(JSON.stringify({
        success: true,
        logs_created: totalLogsCreated,
        errors: allErrors.length > 0 ? allErrors : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== SINGLE LOG CREATION ====================
    if (action === 'log-product-created') {
      const { shop_id, user_id, item_id, item_name, current_price, total_stock, shopee_timestamp, raw_response } = body;

      const result = await logProductCreated(
        supabase, shop_id, user_id, item_id, item_name,
        current_price, total_stock, shopee_timestamp, raw_response
      );

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'log-product-deleted') {
      const { shop_id, user_id, item_id, item_name } = body;

      const result = await logProductDeleted(supabase, shop_id, user_id, item_id, item_name);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== GET HISTORY LOGS ====================
    if (action === 'get-history') {
      const { shop_id, item_id, change_type, severity, is_read, page = 1, page_size = 50 } = body;

      let query = supabase
        .from('apishopee_product_history_logs')
        .select('*', { count: 'exact' })
        .eq('shop_id', shop_id)
        .order('detected_at', { ascending: false });

      if (item_id) query = query.eq('item_id', item_id);
      if (change_type) query = query.eq('change_type', change_type);
      if (severity) query = query.eq('severity', severity);
      if (is_read !== undefined) query = query.eq('is_read', is_read);

      // Pagination
      const offset = (page - 1) * page_size;
      query = query.range(offset, offset + page_size - 1);

      const { data, error, count } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data,
        pagination: {
          page,
          page_size,
          total: count,
          total_pages: Math.ceil((count || 0) / page_size),
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== GET STATS ====================
    if (action === 'get-stats') {
      const { shop_id } = body;

      const { data, error } = await supabase.rpc('get_product_history_stats', { p_shop_id: shop_id });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, stats: data?.[0] || data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== MARK AS READ ====================
    if (action === 'mark-as-read') {
      const { log_ids, shop_id, mark_all } = body;

      let query = supabase
        .from('apishopee_product_history_logs')
        .update({ is_read: true, read_at: new Date().toISOString() });

      if (mark_all && shop_id) {
        query = query.eq('shop_id', shop_id).eq('is_read', false);
      } else if (log_ids && Array.isArray(log_ids)) {
        query = query.in('id', log_ids);
      } else {
        return new Response(JSON.stringify({ error: 'log_ids or mark_all+shop_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error, count } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, updated_count: count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[PRODUCT-WEBHOOK] Error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
