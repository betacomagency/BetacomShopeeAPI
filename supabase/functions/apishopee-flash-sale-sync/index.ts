/**
 * Flash Sale Sync Bot
 * 
 * Đồng bộ danh sách Flash Sale từ Shopee API về database nội bộ
 * Sử dụng chiến thuật UPSERT để quản lý dữ liệu:
 * - Nếu flash_sale_id chưa có -> INSERT
 * - Nếu flash_sale_id đã có -> UPDATE (không xóa để giữ foreign key)
 * 
 * Trigger: Chạy định kỳ 30 phút/lần qua cron job hoặc external scheduler
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface FlashSaleItem {
  flash_sale_id: number;
  timeslot_id: number;
  start_time: number;
  end_time: number;
  type: number; // 1: upcoming, 2: ongoing, 3: expired
  status: number;
  item_count?: number;
  enabled_item_count?: number;
  remindme_count?: number;
  click_count?: number;
}

interface SyncResult {
  shopId: number;
  inserted: number;
  updated: number;
  errors: string[];
}

// ==================== HELPER FUNCTIONS ====================

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function callShopeeAPI(
  apiPath: string,
  method: 'GET' | 'POST',
  shopId: number,
  accessToken: string,
  partnerId: number,
  partnerKey: string,
  params?: Record<string, string | number>,
  body?: Record<string, unknown>
): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  const sign = await hmacSha256(partnerKey, baseString);

  const queryParams = new URLSearchParams();
  queryParams.set('partner_id', partnerId.toString());
  queryParams.set('timestamp', timestamp.toString());
  queryParams.set('access_token', accessToken);
  queryParams.set('shop_id', shopId.toString());
  queryParams.set('sign', sign);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value));
      }
    }
  }

  const url = `${SHOPEE_HOST}${apiPath}?${queryParams.toString()}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return await response.json();
}


/**
 * Lấy danh sách Flash Sale từ Shopee API với pagination
 * Lấy tất cả các trạng thái: Upcoming (1), Ongoing (2), Expired (3)
 */
async function fetchAllFlashSales(
  shopId: number,
  accessToken: string,
  partnerId: number,
  partnerKey: string
): Promise<{ items: FlashSaleItem[]; error?: string }> {
  const allItems: FlashSaleItem[] = [];
  const apiPath = '/api/v2/shop_flash_sale/get_shop_flash_sale_list';
  
  // Lấy tất cả types: 0 = all, 1 = upcoming, 2 = ongoing, 3 = expired
  const types = [1, 2, 3]; // Lấy từng loại để đảm bảo không bỏ sót
  
  for (const type of types) {
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const result = await callShopeeAPI(
          apiPath,
          'GET',
          shopId,
          accessToken,
          partnerId,
          partnerKey,
          { type, offset, limit }
        ) as {
          error?: string;
          message?: string;
          response?: {
            flash_sale_list?: FlashSaleItem[];
            more?: boolean;
          };
        };

        if (result.error) {
          console.error(`[SYNC] Error fetching type ${type}:`, result.message || result.error);
          return { items: allItems, error: result.message || result.error };
        }

        const flashSaleList = result.response?.flash_sale_list || [];
        allItems.push(...flashSaleList);

        hasMore = result.response?.more === true;
        offset += limit;

        // Safety limit để tránh infinite loop
        if (offset > 1000) {
          console.warn(`[SYNC] Reached safety limit for type ${type}`);
          break;
        }
      } catch (err) {
        console.error(`[SYNC] Exception fetching type ${type}:`, err);
        return { items: allItems, error: (err as Error).message };
      }
    }
  }

  // Deduplicate by flash_sale_id (có thể trùng nếu API trả về cùng FS ở nhiều type)
  const uniqueItems = Array.from(
    new Map(allItems.map(item => [item.flash_sale_id, item])).values()
  );

  return { items: uniqueItems };
}

/**
 * UPSERT Flash Sale vào database
 * Sử dụng unique constraint (shop_id, flash_sale_id) để UPSERT
 * - Nếu flash_sale_id chưa có -> INSERT
 * - Nếu flash_sale_id đã có -> UPDATE (giữ nguyên foreign key)
 */
async function upsertFlashSales(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  flashSales: FlashSaleItem[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  const now = new Date().toISOString();

  // Lấy danh sách flash_sale_id đã tồn tại để đếm insert/update
  const { data: existingIds } = await supabase
    .from('apishopee_flash_sale_data')
    .select('flash_sale_id')
    .eq('shop_id', shopId)
    .in('flash_sale_id', flashSales.map(fs => fs.flash_sale_id));

  const existingSet = new Set((existingIds || []).map((e: { flash_sale_id: number }) => e.flash_sale_id));

  // Chuẩn bị data cho batch upsert
  const upsertData = flashSales.map(fs => ({
    shop_id: shopId,
    flash_sale_id: fs.flash_sale_id,
    timeslot_id: fs.timeslot_id,
    start_time: fs.start_time,
    end_time: fs.end_time,
    type: fs.type,
    status: fs.status,
    item_count: fs.item_count || 0,
    enabled_item_count: fs.enabled_item_count || 0,
    remindme_count: fs.remindme_count || 0,
    click_count: fs.click_count || 0,
    raw_response: fs,
    synced_at: now,
    updated_at: now,
  }));

  // Batch upsert với onConflict trên unique constraint (shop_id, flash_sale_id)
  const { error: upsertError } = await supabase
    .from('apishopee_flash_sale_data')
    .upsert(upsertData, {
      onConflict: 'shop_id,flash_sale_id',
      ignoreDuplicates: false, // Update nếu đã tồn tại
    });

  if (upsertError) {
    errors.push(`Batch upsert error: ${upsertError.message}`);
    return { inserted: 0, updated: 0, errors };
  }

  // Đếm số lượng insert/update
  const inserted = flashSales.filter(fs => !existingSet.has(fs.flash_sale_id)).length;
  const updated = flashSales.filter(fs => existingSet.has(fs.flash_sale_id)).length;

  return { inserted, updated, errors };
}


/**
 * Đồng bộ Flash Sale cho một shop
 */
async function syncShopFlashSales(
  supabase: ReturnType<typeof createClient>,
  shop: {
    shop_id: number;
    access_token: string;
    partner_id: number;
    partner_key: string;
  }
): Promise<SyncResult> {
  const result: SyncResult = {
    shopId: shop.shop_id,
    inserted: 0,
    updated: 0,
    errors: [],
  };

  console.log(`[SYNC] Starting sync for shop ${shop.shop_id}`);

  // 1. Fetch tất cả Flash Sales từ Shopee API
  const { items, error: fetchError } = await fetchAllFlashSales(
    shop.shop_id,
    shop.access_token,
    shop.partner_id,
    shop.partner_key
  );

  if (fetchError) {
    result.errors.push(`Fetch error: ${fetchError}`);
  }

  console.log(`[SYNC] Shop ${shop.shop_id}: Fetched ${items.length} flash sales`);

  if (items.length === 0) {
    return result;
  }

  // 2. UPSERT vào database
  const upsertResult = await upsertFlashSales(supabase, shop.shop_id, items);
  result.inserted = upsertResult.inserted;
  result.updated = upsertResult.updated;
  result.errors.push(...upsertResult.errors);

  console.log(`[SYNC] Shop ${shop.shop_id}: Inserted ${result.inserted}, Updated ${result.updated}`);

  // 3. Cập nhật sync status
  await supabase
    .from('apishopee_sync_status')
    .upsert({
      shop_id: shop.shop_id,
      flash_sales_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id' });

  return result;
}

// ==================== MAIN HANDLER ====================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[SYNC] Flash Sale Sync Bot started at ${new Date().toISOString()}`);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Parse request body để lấy shop_id cụ thể (optional)
    let targetShopId: number | null = null;
    try {
      const body = await req.json();
      targetShopId = body?.shop_id || null;
    } catch {
      // No body or invalid JSON - sync all shops
    }

    // Lấy danh sách shops cần sync
    let query = supabase
      .from('apishopee_shops')
      .select('shop_id, access_token, partner_id, partner_key')
      .not('access_token', 'is', null)
      .not('partner_id', 'is', null)
      .not('partner_key', 'is', null);

    if (targetShopId) {
      query = query.eq('shop_id', targetShopId);
    }

    const { data: shops, error: shopsError } = await query;

    if (shopsError) {
      throw new Error(`Failed to fetch shops: ${shopsError.message}`);
    }

    if (!shops || shops.length === 0) {
      console.log('[SYNC] No shops found to sync');
      return new Response(JSON.stringify({
        success: true,
        message: 'No shops found to sync',
        results: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[SYNC] Found ${shops.length} shop(s) to sync`);

    // Sync từng shop
    const results: SyncResult[] = [];
    for (const shop of shops) {
      try {
        const result = await syncShopFlashSales(supabase, shop);
        results.push(result);

        // Delay giữa các shops để tránh rate limit
        if (shops.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error(`[SYNC] Error syncing shop ${shop.shop_id}:`, err);
        results.push({
          shopId: shop.shop_id,
          inserted: 0,
          updated: 0,
          errors: [(err as Error).message],
        });
      }
    }

    // Tổng kết
    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const duration = Date.now() - startTime;

    console.log(`[SYNC] Completed in ${duration}ms`);
    console.log(`[SYNC] Total: ${totalInserted} inserted, ${totalUpdated} updated, ${totalErrors} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${shops.length} shop(s)`,
      summary: {
        shops_synced: shops.length,
        total_inserted: totalInserted,
        total_updated: totalUpdated,
        total_errors: totalErrors,
        duration_ms: duration,
      },
      results,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SYNC] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    }), {
      status: 200, // Return 200 để cron job không retry
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
