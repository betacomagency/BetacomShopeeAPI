/**
 * Supabase Edge Function: Shopee Push Webhook
 *
 * Nhận push notifications từ Shopee và xử lý:
 * - Code 1:  shop_authorization_push - Shop/merchant được authorize → upsert shop record
 * - Code 2:  shop_authorization_canceled_push - Shop/merchant bị deauthorize → xóa token
 * - Code 5:  shopee_updates - Cập nhật từ Shopee platform → log
 * - Code 12: open_api_authorization_expiry - Auth sắp hết hạn → auto refresh token
 * - Code 28: shop_penalty_update_push - Shop bị penalty → log
 *
 * Shopee gửi POST trực tiếp (không có auth header).
 * Timeout: 3 giây. Retry: 300s, 1800s, 10800s.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';

// Map push code → push type name
const PUSH_TYPE_MAP: Record<number, string> = {
  1: 'shop_authorization_push',
  2: 'shop_authorization_canceled_push',
  5: 'shopee_updates',
  12: 'open_api_authorization_expiry',
  28: 'shop_penalty_update_push',
};

// ==================== UTILITIES ====================

/**
 * HMAC-SHA256 using Web Crypto API
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gọi API qua VPS proxy hoặc trực tiếp
 */
async function fetchWithProxy(targetUrl: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    return await fetch(proxyUrl, options);
  }
  return await fetch(targetUrl, options);
}

/**
 * Refresh access token từ Shopee API
 * POST /api/v2/auth/access_token/get
 */
async function refreshShopToken(
  partnerId: number,
  partnerKey: string,
  refreshToken: string,
  shopId?: number,
  merchantId?: number
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/access_token/get';
    const sign = await hmacSha256(partnerKey, `${partnerId}${path}${timestamp}`);

    const body: Record<string, unknown> = {
      refresh_token: refreshToken,
      partner_id: partnerId,
    };
    if (shopId) body.shop_id = shopId;
    if (merchantId) body.merchant_id = merchantId;

    const url = `${SHOPEE_HOST}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result.error) {
      return { success: false, error: result.message || result.error };
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Log push event vào apishopee_push_logs
 */
async function logPush(
  supabase: ReturnType<typeof createClient>,
  pushCode: number,
  payload: Record<string, unknown>,
  processResult?: string
) {
  const pushType = PUSH_TYPE_MAP[pushCode] || `unknown_push_${pushCode}`;

  const { error } = await supabase.from('apishopee_push_logs').insert({
    push_code: pushCode,
    push_type: pushType,
    shop_id: payload.shop_id || null,
    merchant_id: (payload.data as Record<string, unknown>)?.merchant_id || null,
    partner_id: payload.partner_id || null,
    data: payload,
    processed: !!processResult,
    process_result: processResult || null,
    shopee_timestamp: payload.timestamp || null,
  });

  if (error) {
    console.error('[WEBHOOK] Failed to log push:', error);
  }
}

// ==================== PUSH HANDLERS ====================

/**
 * Code 1: shop_authorization_push
 * Shop/merchant được authorize cho app
 * → Upsert shop record (tạo mới nếu chưa có, update status nếu đã có)
 */
async function handleAuthorizationPush(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<string> {
  const data = payload.data as Record<string, unknown>;
  if (!data) return 'no data';

  const shopId = data.shop_id as number | undefined;
  const shopIdList = data.shop_id_list as number[] | undefined;
  const merchantId = data.merchant_id as number | undefined;
  const mainAccountId = data.main_account_id as number | undefined;
  const authorizeType = data.authorize_type as string || '';
  const partnerId = payload.partner_id as number | undefined;

  console.log('[WEBHOOK] Authorization push:', { shopId, shopIdList, merchantId, mainAccountId, authorizeType, partnerId });

  const shopIds = shopIdList || (shopId ? [shopId] : []);
  if (shopIds.length === 0) {
    return `authorized: 0 shops, merchant: ${merchantId || 'none'}`;
  }

  // Lookup partner credentials từ apishopee_partner_apps
  let partnerKey: string | null = null;
  let partnerName: string | null = null;
  if (partnerId) {
    const { data: partnerApp } = await supabase
      .from('apishopee_partner_apps')
      .select('partner_key, partner_name')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (partnerApp) {
      partnerKey = partnerApp.partner_key;
      partnerName = partnerApp.partner_name;
    }
  }

  // Upsert từng shop: tạo mới nếu chưa có, update status nếu đã có
  let created = 0;
  let updated = 0;

  for (const sid of shopIds) {
    // Check shop có tồn tại chưa
    const { data: existing } = await supabase
      .from('apishopee_shops')
      .select('shop_id')
      .eq('shop_id', sid)
      .single();

    if (existing) {
      // Shop đã có → update status
      await supabase
        .from('apishopee_shops')
        .update({
          status: 'active',
          merchant_id: merchantId || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_id', sid);
      updated++;
    } else {
      // Shop mới → insert record cơ bản
      const { error: insertError } = await supabase
        .from('apishopee_shops')
        .insert({
          shop_id: sid,
          partner_id: partnerId || null,
          partner_key: partnerKey || null,
          partner_name: partnerName || null,
          merchant_id: merchantId || null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`[WEBHOOK] Failed to insert shop ${sid}:`, insertError);
      } else {
        created++;
      }
    }
  }

  return `authorized: ${shopIds.length} shops (${created} new, ${updated} updated), merchant: ${merchantId || 'none'}`;
}

/**
 * Code 2: shop_authorization_canceled_push
 * Shop/merchant bị deauthorize - xóa token, cập nhật status
 */
async function handleAuthorizationCanceled(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<string> {
  const data = payload.data as Record<string, unknown>;
  if (!data) return 'no data';

  const shopId = data.shop_id as number | undefined;
  const shopIdList = data.shop_id_list as number[] | undefined;
  const merchantId = data.merchant_id as number | undefined;
  const merchantIdList = data.merchant_id_list as number[] | undefined;
  const authorizeType = data.authorize_type as string || '';
  // Shopee dùng "shopid" (không có underscore) trong một số payload
  const shopIdAlt = data.shopid as number | undefined;

  console.log('[WEBHOOK] Authorization canceled:', { shopId, shopIdAlt, shopIdList, merchantId, merchantIdList, authorizeType });

  // Thu thập tất cả shop IDs cần deauthorize
  const shopIds = [
    ...(shopIdList || []),
    ...(shopId ? [shopId] : []),
    ...(shopIdAlt ? [shopIdAlt] : []),
  ];

  if (shopIds.length > 0) {
    // Xóa token và set status = deauthorized
    const { error } = await supabase
      .from('apishopee_shops')
      .update({
        access_token: null,
        refresh_token: null,
        expired_at: null,
        access_token_expired_at: null,
        status: 'deauthorized',
        updated_at: new Date().toISOString(),
      })
      .in('shop_id', shopIds);

    if (error) {
      console.error('[WEBHOOK] Failed to deauthorize shops:', error);
      return `error deauthorizing shops: ${error.message}`;
    }
  }

  // Nếu deauthorize theo merchant, tìm tất cả shop thuộc merchant đó
  const merchantIds = merchantIdList || (merchantId ? [merchantId] : []);
  if (merchantIds.length > 0) {
    const { error } = await supabase
      .from('apishopee_shops')
      .update({
        access_token: null,
        refresh_token: null,
        expired_at: null,
        access_token_expired_at: null,
        status: 'deauthorized',
        updated_at: new Date().toISOString(),
      })
      .in('merchant_id', merchantIds);

    if (error) {
      console.error('[WEBHOOK] Failed to deauthorize by merchant:', error);
      return `error deauthorizing merchants: ${error.message}`;
    }
  }

  return `deauthorized: ${shopIds.length} shops, ${merchantIds.length} merchants, type: ${authorizeType}`;
}

/**
 * Code 12: open_api_authorization_expiry
 * Thông báo auth sắp hết hạn trong 1 tuần
 * → Đánh dấu status + tự động refresh token
 */
async function handleAuthorizationExpiry(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<string> {
  const data = payload.data as Record<string, unknown>;
  if (!data) return 'no data';

  const shopExpireSoon = data.shop_expire_soon as number[] || [];
  const merchantExpireSoon = data.merchant_expire_soon as number[] || [];
  const userExpireSoon = data.user_expire_soon as number[] || [];
  const expireBefore = data.expire_before as number | undefined;
  const pageNo = data.page_no as number || 1;
  const totalPage = data.total_page as number || 1;

  console.log('[WEBHOOK] Authorization expiry:', {
    shops: shopExpireSoon.length,
    merchants: merchantExpireSoon.length,
    users: userExpireSoon.length,
    expireBefore,
    page: `${pageNo}/${totalPage}`,
  });

  // Đánh dấu shop sắp hết hạn
  if (shopExpireSoon.length > 0) {
    await supabase
      .from('apishopee_shops')
      .update({ status: 'expiring_soon', updated_at: new Date().toISOString() })
      .in('shop_id', shopExpireSoon)
      .neq('status', 'deauthorized');
  }

  // Đánh dấu merchant sắp hết hạn
  if (merchantExpireSoon.length > 0) {
    await supabase
      .from('apishopee_shops')
      .update({ status: 'expiring_soon', updated_at: new Date().toISOString() })
      .in('merchant_id', merchantExpireSoon)
      .neq('status', 'deauthorized');
  }

  // ===== Auto refresh token cho shops sắp hết hạn =====
  const allShopIds = [...shopExpireSoon];

  // Lấy thêm shop_ids từ merchant expiring
  if (merchantExpireSoon.length > 0) {
    const { data: merchantShops } = await supabase
      .from('apishopee_shops')
      .select('shop_id')
      .in('merchant_id', merchantExpireSoon)
      .not('refresh_token', 'is', null);

    if (merchantShops) {
      for (const s of merchantShops) {
        if (!allShopIds.includes(s.shop_id)) {
          allShopIds.push(s.shop_id);
        }
      }
    }
  }

  // Query shops cần refresh
  let refreshed = 0;
  let refreshFailed = 0;

  if (allShopIds.length > 0) {
    const { data: shops } = await supabase
      .from('apishopee_shops')
      .select('shop_id, refresh_token, partner_id, partner_key, merchant_id')
      .in('shop_id', allShopIds)
      .not('refresh_token', 'is', null)
      .not('partner_id', 'is', null)
      .not('partner_key', 'is', null);

    if (shops && shops.length > 0) {
      // Group theo merchant_id để tối ưu (1 refresh cho cả merchant)
      const merchantGroups = new Map<number, typeof shops>();
      const standaloneShops: typeof shops = [];

      for (const shop of shops) {
        if (shop.merchant_id) {
          const group = merchantGroups.get(shop.merchant_id) || [];
          group.push(shop);
          merchantGroups.set(shop.merchant_id, group);
        } else {
          standaloneShops.push(shop);
        }
      }

      // Refresh theo merchant group (1 call refresh cho cả merchant)
      for (const [merchantId, groupShops] of merchantGroups) {
        const representative = groupShops[0];
        console.log(`[WEBHOOK] Refreshing merchant ${merchantId} (${groupShops.length} shops)`);

        const result = await refreshShopToken(
          representative.partner_id,
          representative.partner_key,
          representative.refresh_token,
          undefined, // không gửi shop_id
          merchantId
        );

        if (result.success && result.data) {
          const now = Date.now();
          const expireIn = (result.data.expire_in as number) || 0;
          const newExpiredAt = now + expireIn * 1000;

          // Update tất cả shops trong merchant group
          const { error } = await supabase
            .from('apishopee_shops')
            .update({
              access_token: result.data.access_token,
              refresh_token: result.data.refresh_token,
              expired_at: newExpiredAt,
              access_token_expired_at: newExpiredAt,
              expire_in: expireIn,
              status: 'active',
              token_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .in('shop_id', groupShops.map((s: { shop_id: number }) => s.shop_id));

          if (!error) {
            refreshed += groupShops.length;
          } else {
            console.error(`[WEBHOOK] Failed to update merchant ${merchantId} tokens:`, error);
            refreshFailed += groupShops.length;
          }
        } else {
          console.error(`[WEBHOOK] Failed to refresh merchant ${merchantId}:`, result.error);
          refreshFailed += groupShops.length;
        }
      }

      // Refresh standalone shops (1 call mỗi shop)
      for (const shop of standaloneShops) {
        console.log(`[WEBHOOK] Refreshing standalone shop ${shop.shop_id}`);

        const result = await refreshShopToken(
          shop.partner_id,
          shop.partner_key,
          shop.refresh_token,
          shop.shop_id
        );

        if (result.success && result.data) {
          const now = Date.now();
          const expireIn = (result.data.expire_in as number) || 0;
          const newExpiredAt = now + expireIn * 1000;

          const { error } = await supabase
            .from('apishopee_shops')
            .update({
              access_token: result.data.access_token,
              refresh_token: result.data.refresh_token,
              expired_at: newExpiredAt,
              access_token_expired_at: newExpiredAt,
              expire_in: expireIn,
              status: 'active',
              token_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('shop_id', shop.shop_id);

          if (!error) {
            refreshed++;
          } else {
            console.error(`[WEBHOOK] Failed to update shop ${shop.shop_id} token:`, error);
            refreshFailed++;
          }
        } else {
          console.error(`[WEBHOOK] Failed to refresh shop ${shop.shop_id}:`, result.error);
          refreshFailed++;
        }
      }
    }
  }

  return `expiring: ${shopExpireSoon.length} shops, ${merchantExpireSoon.length} merchants, ${userExpireSoon.length} users (page ${pageNo}/${totalPage}) | refreshed: ${refreshed} ok, ${refreshFailed} failed`;
}

/**
 * Code 28: shop_penalty_update_push
 * Shop bị penalty: thêm/xóa điểm phạt hoặc cập nhật tier
 */
async function handlePenaltyUpdate(
  _supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<string> {
  const data = payload.data as Record<string, unknown>;
  const shopId = payload.shop_id as number;
  if (!data) return 'no data';

  const actionType = data.action_type as number;

  let result = '';
  switch (actionType) {
    case 1: {
      const pointsData = data.points_issued_data as Record<string, unknown>;
      result = `shop ${shopId}: +${pointsData?.issued_points} penalty points (violation: ${pointsData?.violation_type})`;
      break;
    }
    case 2: {
      const removedData = data.points_removed_data as Record<string, unknown>;
      result = `shop ${shopId}: -${removedData?.removed_points} penalty points (reason: ${removedData?.removed_reason})`;
      break;
    }
    case 3: {
      const tierData = data.tier_update_data as Record<string, unknown>;
      result = `shop ${shopId}: tier ${tierData?.old_tier} → ${tierData?.new_tier}`;
      break;
    }
    default:
      result = `shop ${shopId}: unknown action_type ${actionType}`;
  }

  console.log('[WEBHOOK] Penalty update:', result);
  return result;
}

/**
 * Code 5: shopee_updates
 * Cập nhật từ Shopee platform (tin tức, thông báo)
 */
async function handleShopeeUpdates(
  _supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
): Promise<string> {
  const data = payload.data as Record<string, unknown>;
  const shopId = payload.shop_id as number;
  if (!data) return 'no data';

  const actions = data.actions as Array<Record<string, unknown>> || [];

  console.log('[WEBHOOK] Shopee updates for shop', shopId, ':', actions.length, 'items');

  const titles = actions.map(a => a.title).join(', ');
  return `shop ${shopId}: ${actions.length} updates (${titles})`;
}

// ==================== BACKGROUND PROCESSOR ====================

/**
 * Xử lý push notification trong background (không block response)
 */
async function processInBackground(payload: Record<string, unknown>) {
  const pushCode = payload.code as number;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let processResult = '';

    switch (pushCode) {
      case 1:
        processResult = await handleAuthorizationPush(supabase, payload);
        break;
      case 2:
        processResult = await handleAuthorizationCanceled(supabase, payload);
        break;
      case 5:
        processResult = await handleShopeeUpdates(supabase, payload);
        break;
      case 12:
        processResult = await handleAuthorizationExpiry(supabase, payload);
        break;
      case 28:
        processResult = await handlePenaltyUpdate(supabase, payload);
        break;
      default:
        processResult = `unhandled push code: ${pushCode}`;
        console.log('[WEBHOOK] Unhandled push code:', pushCode);
    }

    await logPush(supabase, pushCode, payload, processResult);
    console.log('[WEBHOOK] Processed:', processResult);
  } catch (err) {
    console.error('[WEBHOOK] Background processing error:', err);

    // Vẫn log lỗi vào DB
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await logPush(supabase, pushCode, payload, `error: ${(err as Error).message}`);
    } catch {
      console.error('[WEBHOOK] Failed to log error');
    }
  }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
      },
    });
  }

  // Trả 200 ngay cho mọi method (Shopee timeout 3 giây)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json() as Record<string, unknown>;
    const pushCode = payload.code as number;

    console.log('[WEBHOOK] Received push:', { code: pushCode, keys: Object.keys(payload) });

    // Fire-and-forget: xử lý background, trả 200 ngay
    if (pushCode) {
      // Không await - chạy background
      processInBackground(payload).catch(err =>
        console.error('[WEBHOOK] Background error:', err)
      );
    }
  } catch (err) {
    console.error('[WEBHOOK] Parse error:', err);
  }

  // Luôn trả 200 ngay lập tức
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
