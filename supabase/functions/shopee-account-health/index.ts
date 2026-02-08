/**
 * Supabase Edge Function: Shopee Account Health
 * Lấy tất cả chỉ số hiệu quả hoạt động shop từ Shopee API
 * 7 API: shopPenalty, shopPerformance, penaltyPointHistory,
 *        punishmentOngoing, punishmentCompleted, listingsIssues, lateOrders
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PARTNER_ID = Number(Deno.env.get('SHOPEE_PARTNER_ID'));
const DEFAULT_PARTNER_KEY = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
const SHOPEE_BASE_URL = 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const REQUEST_TIMEOUT_MS = 15000;

interface PartnerCredentials {
  partnerId: number;
  partnerKey: string;
}

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const fetchOptions = { ...options, signal: controller.signal };
    if (PROXY_URL) {
      const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
      return await fetch(proxyUrl, fetchOptions);
    }
    return await fetch(targetUrl, fetchOptions);
  } finally {
    clearTimeout(timeoutId);
  }
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
  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('shop_id, access_token, refresh_token, expired_at, merchant_id')
    .eq('shop_id', shopId)
    .single();

  if (!error && data?.access_token) {
    return data;
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
  extraParams?: Record<string, string | number | boolean>
): Promise<Record<string, unknown>> {
  const startTime = Date.now();

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

    try {
      const response = await fetchWithProxy(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (fetchError) {
      const err = fetchError as Error;
      if (err.name === 'AbortError') {
        return { error: 'timeout', message: `Request timeout after ${REQUEST_TIMEOUT_MS}ms` };
      }
      throw fetchError;
    }
  };

  let result = await makeRequest(token.access_token);

  // Auto-retry on token expiry
  if (result.error === 'error_auth' || result.message?.includes('Invalid access_token')) {
    console.log('[ACCOUNT-HEALTH] Token expired, refreshing...');
    const newToken = await refreshAccessToken(credentials, token.refresh_token, shopId);

    if (!newToken.error) {
      await saveToken(supabase, shopId, newToken);
      result = await makeRequest(newToken.access_token);
    }
  }

  // Log API call
  const duration = Date.now() - startTime;
  console.log(`[ACCOUNT-HEALTH] ${path} - ${!result.error || result.error === '' ? 'success' : 'failed'} (${duration}ms)`);

  return result;
}

// ==================== API DEFINITIONS ====================

interface ApiCall {
  name: string;
  path: string;
  params?: Record<string, string | number | boolean>;
}

const ACCOUNT_HEALTH_APIS: ApiCall[] = [
  { name: 'shopPenalty', path: '/api/v2/account_health/shop_penalty' },
  { name: 'shopPerformance', path: '/api/v2/account_health/get_shop_performance' },
  { name: 'penaltyPointHistory', path: '/api/v2/account_health/get_penalty_point_history', params: { page_size: 100 } },
  { name: 'punishmentOngoing', path: '/api/v2/account_health/get_punishment_history', params: { punishment_status: 1, page_size: 100 } },
  { name: 'punishmentCompleted', path: '/api/v2/account_health/get_punishment_history', params: { punishment_status: 2, page_size: 100 } },
  { name: 'listingsIssues', path: '/api/v2/account_health/get_listings_with_issues', params: { page_size: 100 } },
  { name: 'lateOrders', path: '/api/v2/account_health/get_late_orders', params: { page_size: 100 } },
];

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, shop_id, fetch_source } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let result;

    switch (action) {
      case 'get-all': {
        if (!shop_id) {
          return new Response(JSON.stringify({ error: 'shop_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const credentials = await getPartnerCredentials(supabase, shop_id);
        const token = await getTokenWithAutoRefresh(supabase, shop_id);

        console.log(`[ACCOUNT-HEALTH] Calling ${ACCOUNT_HEALTH_APIS.length} APIs for shop ${shop_id}`);

        const results = await Promise.allSettled(
          ACCOUNT_HEALTH_APIS.map(api =>
            callShopeeAPI(supabase, credentials, api.path, 'GET', shop_id, token, api.params)
          )
        );

        let successCount = 0;
        let failedCount = 0;
        const responseData: Record<string, unknown> = {};

        results.forEach((r, i) => {
          const apiName = ACCOUNT_HEALTH_APIS[i].name;
          if (r.status === 'fulfilled') {
            responseData[apiName] = r.value;
            const val = r.value as Record<string, unknown>;
            if (!val.error || val.error === '') {
              successCount++;
            } else {
              failedCount++;
            }
          } else {
            responseData[apiName] = { error: r.reason?.message || 'Unknown error', message: r.reason?.message, response: null };
            failedCount++;
          }
        });

        console.log(`[ACCOUNT-HEALTH] Done: ${successCount}/${ACCOUNT_HEALTH_APIS.length} success, ${failedCount} failed`);

        // Non-blocking save to DB
        if (successCount > 0) {
          supabase.from('apishopee_account_health').insert({
            shop_id: shop_id,
            shop_penalty: responseData.shopPenalty || null,
            shop_performance: responseData.shopPerformance || null,
            penalty_point_history: responseData.penaltyPointHistory || null,
            punishment_ongoing: responseData.punishmentOngoing || null,
            punishment_completed: responseData.punishmentCompleted || null,
            listings_issues: responseData.listingsIssues || null,
            late_orders: responseData.lateOrders || null,
            api_success_count: successCount,
            api_failed_count: failedCount,
            fetch_source: fetch_source || 'manual',
          }).then(({ error: dbErr }) => {
            if (dbErr) console.error('[ACCOUNT-HEALTH] DB save error:', dbErr.message);
            else console.log('[ACCOUNT-HEALTH] Data saved to DB');
          });
        }

        result = {
          ...responseData,
          _meta: {
            total_apis: ACCOUNT_HEALTH_APIS.length,
            success: successCount,
            failed: failedCount,
            timestamp: new Date().toISOString(),
          },
        };
        break;
      }

      case 'sync-all': {
        // Cron job: fetch account health cho tất cả active shops
        // Xử lý theo batch (5 shop/lần), delay 1s để vừa timeout ~200s
        const BATCH_SIZE = 5;
        const BATCH_DELAY_MS = 1000; // 1s giữa mỗi batch

        const { data: activeShops, error: shopsErr } = await supabase
          .from('apishopee_shops')
          .select('shop_id')
          .not('access_token', 'is', null)
          .not('access_token', 'eq', '');

        if (shopsErr || !activeShops?.length) {
          result = { message: 'No active shops found', shops_count: 0 };
          break;
        }

        console.log(`[ACCOUNT-HEALTH] Sync-all: ${activeShops.length} shops (batch=${BATCH_SIZE}, delay=${BATCH_DELAY_MS}ms)`);

        const summary: Array<{ shop_id: number; status: string; success?: number; failed?: number; error?: string }> = [];

        // Chia thành từng batch
        for (let i = 0; i < activeShops.length; i += BATCH_SIZE) {
          const batch = activeShops.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          console.log(`[ACCOUNT-HEALTH] Batch ${batchNum}: shops ${batch.map(s => s.shop_id).join(', ')}`);

          const batchResults = await Promise.allSettled(
            batch.map(async (shop) => {
              const credentials = await getPartnerCredentials(supabase, shop.shop_id);
              const token = await getTokenWithAutoRefresh(supabase, shop.shop_id);

              const apiResults = await Promise.allSettled(
                ACCOUNT_HEALTH_APIS.map(api =>
                  callShopeeAPI(supabase, credentials, api.path, 'GET', shop.shop_id, token, api.params)
                )
              );

              let success = 0;
              let failed = 0;
              const data: Record<string, unknown> = {};

              apiResults.forEach((r, idx) => {
                const apiName = ACCOUNT_HEALTH_APIS[idx].name;
                if (r.status === 'fulfilled') {
                  data[apiName] = r.value;
                  const val = r.value as Record<string, unknown>;
                  if (!val.error || val.error === '') success++;
                  else failed++;
                } else {
                  data[apiName] = { error: r.reason?.message || 'Unknown error' };
                  failed++;
                }
              });

              if (success > 0) {
                await supabase.from('apishopee_account_health').insert({
                  shop_id: shop.shop_id,
                  shop_penalty: data.shopPenalty || null,
                  shop_performance: data.shopPerformance || null,
                  penalty_point_history: data.penaltyPointHistory || null,
                  punishment_ongoing: data.punishmentOngoing || null,
                  punishment_completed: data.punishmentCompleted || null,
                  listings_issues: data.listingsIssues || null,
                  late_orders: data.lateOrders || null,
                  api_success_count: success,
                  api_failed_count: failed,
                  fetch_source: 'cron',
                });
              }

              return { shop_id: shop.shop_id, success, failed };
            })
          );

          // Ghi kết quả batch
          batchResults.forEach((r, idx) => {
            summary.push({
              shop_id: batch[idx].shop_id,
              status: r.status,
              ...(r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason?.message }),
            });
          });

          // Delay giữa các batch (trừ batch cuối)
          if (i + BATCH_SIZE < activeShops.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        console.log(`[ACCOUNT-HEALTH] Sync-all done: ${summary.filter(s => s.status === 'fulfilled').length}/${activeShops.length} success`);

        result = {
          message: `Synced ${activeShops.length} shops (batch=${BATCH_SIZE})`,
          shops_count: activeShops.length,
          results: summary,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action. Use: get-all, sync-all' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ACCOUNT-HEALTH] Error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      success: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
