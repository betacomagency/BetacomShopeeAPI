/**
 * Token Refresh — ported from shopee-token-refresh Edge Function.
 *
 * Runs every 30 minutes. Refreshes Shopee access tokens for shops expiring within 3 hours.
 * Two passes:
 * 1. Main shop tokens (apishopee_shops) — grouped by merchant_id for efficiency
 * 2. Multi-app tokens (apishopee_shop_app_tokens) — same grouping
 *
 * Auth-level signing: baseString = partnerId + path + timestamp (no token/shopId)
 */
import { createHmac } from 'crypto';
import { supabase } from '../lib/supabase';
import { config } from '../config';
import { logApiCall, createResponseSummary } from '../utils/api-logger';
import { logActivity } from '../utils/activity-logger';

// ==================== CONSTANTS ====================

const REFRESH_THRESHOLD_HOURS = 3;
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT_MS = 10000;
const DELAY_BETWEEN_SHOPS_MS = 500;
const MAX_CONCURRENT_IN_BATCH = 3;
const TRIGGERED_BY = 'cron' as const;

// ==================== TYPES ====================

interface ShopToken {
  id: string;
  shop_id: number;
  shop_name: string | null;
  access_token: string;
  refresh_token: string;
  expired_at: number;
  expire_in: number;
  partner_id: number;
  partner_key: string;
  merchant_id?: number;
}

interface RefreshResult {
  shop_id: number;
  shop_name: string | null;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

// ==================== HELPERS ====================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Auth-level signing: no accessToken or shopId in base string */
function createAuthSignature(partnerId: number, partnerKey: string, path: string, timestamp: number): string {
  const baseString = `${partnerId}${path}${timestamp}`;
  return createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

async function callRefreshApi(
  partnerId: number,
  partnerKey: string,
  refreshToken: string,
  shopId: number,
  merchantId?: number
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/access_token/get';
    const sign = createAuthSignature(partnerId, partnerKey, path, timestamp);

    const body: Record<string, unknown> = {
      refresh_token: refreshToken,
      partner_id: partnerId,
    };
    if (shopId) body.shop_id = shopId;
    if (merchantId) body.merchant_id = merchantId;

    const url = `${config.shopeeBaseUrl}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const result = await response.json() as Record<string, unknown>;
    if (result.error) {
      return { success: false, error: (result.message || result.error) as string };
    }
    return { success: true, data: result };
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      return { success: false, error: `Request timeout after ${REQUEST_TIMEOUT_MS}ms` };
    }
    return { success: false, error: err.message };
  }
}

async function logRefreshResult(
  shopId: string,
  shopeeShopId: number,
  shopName: string | null,
  success: boolean,
  errorMessage?: string,
  oldExpiredAt?: number,
  newExpiredAt?: number
): Promise<void> {
  try {
    // Note: apishopee_token_refresh_logs table may not exist — skip if missing
    await supabase.from('apishopee_token_refresh_logs').insert({
      shop_id: shopId,
      shopee_shop_id: shopeeShopId,
      success,
      error_message: errorMessage,
      old_token_expired_at: oldExpiredAt,
      new_token_expired_at: newExpiredAt,
      refresh_source: 'auto',
    }).then(({ error }) => {
      if (error) console.warn('[TOKEN-REFRESH] Log table insert skipped:', error.message);
    });

    await logActivity(supabase, {
      shopId: shopeeShopId,
      actionType: 'token_refresh',
      actionCategory: 'auth',
      status: success ? 'success' : 'failed',
      source: 'scheduled',
      errorMessage,
    });
  } catch (e) {
    console.error('[TOKEN-REFRESH] Log error:', (e as Error).message);
  }
}

// ==================== BATCH PROCESSOR ====================

async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = MAX_CONCURRENT_IN_BATCH
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await delay(DELAY_BETWEEN_SHOPS_MS);
    }
  }
  return results;
}

// ==================== MAIN LOGIC ====================

async function getShopsNeedingRefresh(): Promise<ShopToken[]> {
  const thresholdTime = Date.now() + REFRESH_THRESHOLD_HOURS * 60 * 60 * 1000;

  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('id, shop_id, shop_name, access_token, refresh_token, expired_at, expire_in, partner_id, partner_key, merchant_id')
    .not('refresh_token', 'is', null)
    .not('partner_id', 'is', null)
    .not('partner_key', 'is', null)
    .or(`expired_at.lt.${thresholdTime},expired_at.is.null`);

  if (error) {
    console.error('[TOKEN-REFRESH] Error fetching shops:', error.message);
    return [];
  }
  return (data || []) as ShopToken[];
}

async function refreshMerchantGroup(
  merchantId: number,
  shops: ShopToken[]
): Promise<RefreshResult[]> {
  const rep = shops[0];
  if (!rep.refresh_token || !rep.partner_id || !rep.partner_key) {
    return shops.map(s => ({ shop_id: s.shop_id, shop_name: s.shop_name, status: 'skipped' as const, error: 'Missing credentials' }));
  }

  console.log(`[TOKEN-REFRESH] Refreshing merchant ${merchantId} (${shops.length} shops)`);

  const startTime = Date.now();
  const refreshResult = await callRefreshApi(rep.partner_id, rep.partner_key, rep.refresh_token, 0, merchantId);

  logApiCall(supabase, {
    shopId: rep.shop_id, partnerId: rep.partner_id,
    edgeFunction: 'worker-token-refresh',
    apiEndpoint: '/api/v2/auth/access_token/get',
    httpMethod: 'POST', apiCategory: 'auth',
    status: refreshResult.success ? 'success' : 'failed',
    shopeeError: refreshResult.success ? undefined : refreshResult.error,
    durationMs: Date.now() - startTime,
    responseSummary: createResponseSummary(refreshResult.data || { error: refreshResult.error }),
    triggeredBy: TRIGGERED_BY,
  });

  if (!refreshResult.success || !refreshResult.data) {
    for (const shop of shops) {
      await logRefreshResult(shop.id, shop.shop_id, shop.shop_name, false, refreshResult.error, shop.expired_at);
    }
    return shops.map(s => ({ shop_id: s.shop_id, shop_name: s.shop_name, status: 'failed' as const, error: refreshResult.error }));
  }

  const newToken = refreshResult.data;
  const newExpiredAt = Date.now() + (newToken.expire_in as number) * 1000;

  const { error: updateError } = await supabase
    .from('apishopee_shops')
    .update({
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token,
      expire_in: newToken.expire_in,
      expired_at: newExpiredAt,
      access_token_expired_at: newExpiredAt,
      token_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchantId);

  if (updateError) {
    for (const shop of shops) {
      await logRefreshResult(shop.id, shop.shop_id, shop.shop_name, false, `DB update failed: ${updateError.message}`, shop.expired_at);
    }
    return shops.map(s => ({ shop_id: s.shop_id, shop_name: s.shop_name, status: 'failed' as const, error: updateError.message }));
  }

  console.log(`[TOKEN-REFRESH] Merchant ${merchantId}: updated ${shops.length} shops`);
  for (const shop of shops) {
    await logRefreshResult(shop.id, shop.shop_id, shop.shop_name, true, undefined, shop.expired_at, Date.now());
  }
  return shops.map(s => ({ shop_id: s.shop_id, shop_name: s.shop_name, status: 'success' as const }));
}

async function refreshStandaloneShop(shop: ShopToken): Promise<RefreshResult> {
  if (!shop.refresh_token || !shop.partner_id || !shop.partner_key) {
    return { shop_id: shop.shop_id, shop_name: shop.shop_name, status: 'skipped', error: 'Missing credentials' };
  }

  const startTime = Date.now();
  const refreshResult = await callRefreshApi(shop.partner_id, shop.partner_key, shop.refresh_token, shop.shop_id);

  logApiCall(supabase, {
    shopId: shop.shop_id, partnerId: shop.partner_id,
    edgeFunction: 'worker-token-refresh',
    apiEndpoint: '/api/v2/auth/access_token/get',
    httpMethod: 'POST', apiCategory: 'auth',
    status: refreshResult.success ? 'success' : 'failed',
    shopeeError: refreshResult.success ? undefined : refreshResult.error,
    durationMs: Date.now() - startTime,
    responseSummary: createResponseSummary(refreshResult.data || { error: refreshResult.error }),
    triggeredBy: TRIGGERED_BY,
  });

  if (!refreshResult.success || !refreshResult.data) {
    await logRefreshResult(shop.id, shop.shop_id, shop.shop_name, false, refreshResult.error, shop.expired_at);
    return { shop_id: shop.shop_id, shop_name: shop.shop_name, status: 'failed', error: refreshResult.error };
  }

  const newToken = refreshResult.data;
  const newExpiredAt = Date.now() + (newToken.expire_in as number) * 1000;

  const { error: updateError } = await supabase
    .from('apishopee_shops')
    .update({
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token,
      expire_in: newToken.expire_in,
      expired_at: newExpiredAt,
      access_token_expired_at: newExpiredAt,
      token_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shop.id);

  if (updateError) {
    await logRefreshResult(shop.id, shop.shop_id, shop.shop_name, false, `DB update failed: ${updateError.message}`, shop.expired_at);
    return { shop_id: shop.shop_id, shop_name: shop.shop_name, status: 'failed', error: updateError.message };
  }

  await logRefreshResult(shop.id, shop.shop_id, shop.shop_name, true, undefined, shop.expired_at, Date.now());
  return { shop_id: shop.shop_id, shop_name: shop.shop_name, status: 'success' };
}

// ==================== PASS 2: APP TOKENS ====================

async function refreshAppTokens(): Promise<RefreshResult[]> {
  const thresholdTime = Date.now() + REFRESH_THRESHOLD_HOURS * 60 * 60 * 1000;
  const results: RefreshResult[] = [];

  const { data: appTokens, error } = await supabase
    .from('apishopee_shop_app_tokens')
    .select('id, shop_id, partner_app_id, access_token, refresh_token, expired_at, merchant_id, apishopee_partner_apps!inner(partner_id, partner_key, partner_name, app_category)')
    .not('refresh_token', 'is', null)
    .or(`expired_at.lt.${thresholdTime},expired_at.is.null`);

  if (error || !appTokens?.length) return results;

  console.log(`[TOKEN-REFRESH] Found ${appTokens.length} app tokens needing refresh`);

  // Group by merchant_id
  const merchantGroups = new Map<number, typeof appTokens>();
  const standalone: typeof appTokens = [];

  for (const at of appTokens) {
    if (at.merchant_id) {
      const group = merchantGroups.get(at.merchant_id) || [];
      group.push(at);
      merchantGroups.set(at.merchant_id, group);
    } else {
      standalone.push(at);
    }
  }

  // Process merchant groups
  for (const [merchantId, groupTokens] of merchantGroups) {
    const rep = groupTokens[0];
    const appInfo = rep.apishopee_partner_apps as unknown as { partner_id: number; partner_key: string; partner_name: string; app_category: string };

    const refreshResult = await callRefreshApi(appInfo.partner_id, appInfo.partner_key, rep.refresh_token, 0, merchantId);

    if (refreshResult.success && refreshResult.data) {
      const newToken = refreshResult.data;
      const newExpiredAt = Date.now() + (newToken.expire_in as number) * 1000;

      for (const at of groupTokens) {
        const { error: updateError } = await supabase
          .from('apishopee_shop_app_tokens')
          .update({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token,
            expire_in: newToken.expire_in,
            expired_at: newExpiredAt,
            token_updated_at: new Date().toISOString(),
          })
          .eq('id', at.id);

        results.push({
          shop_id: at.shop_id,
          shop_name: `[${appInfo.app_category}] ${appInfo.partner_name}`,
          status: updateError ? 'failed' : 'success',
          error: updateError?.message,
        });
      }
    } else {
      for (const at of groupTokens) {
        results.push({
          shop_id: at.shop_id,
          shop_name: `[${appInfo.app_category}] ${appInfo.partner_name}`,
          status: 'failed', error: refreshResult.error,
        });
      }
    }
  }

  // Process standalone app tokens
  for (const at of standalone) {
    const appInfo = at.apishopee_partner_apps as unknown as { partner_id: number; partner_key: string; partner_name: string; app_category: string };

    const refreshResult = await callRefreshApi(appInfo.partner_id, appInfo.partner_key, at.refresh_token, at.shop_id);

    if (refreshResult.success && refreshResult.data) {
      const newToken = refreshResult.data;
      const newExpiredAt = Date.now() + (newToken.expire_in as number) * 1000;

      const { error: updateError } = await supabase
        .from('apishopee_shop_app_tokens')
        .update({
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          expire_in: newToken.expire_in,
          expired_at: newExpiredAt,
          token_updated_at: new Date().toISOString(),
        })
        .eq('id', at.id);

      results.push({
        shop_id: at.shop_id,
        shop_name: `[${appInfo.app_category}] ${appInfo.partner_name}`,
        status: updateError ? 'failed' : 'success',
        error: updateError?.message,
      });
    } else {
      results.push({
        shop_id: at.shop_id,
        shop_name: `[${appInfo.app_category}] ${appInfo.partner_name}`,
        status: 'failed', error: refreshResult.error,
      });
    }
  }

  return results;
}

// ==================== MAIN ENTRY POINT ====================

let _isRunning = false;

export function isTokenRefreshRunning(): boolean {
  return _isRunning;
}

export async function runTokenRefresh(): Promise<void> {
  if (_isRunning) {
    console.log('[TOKEN-REFRESH] Previous run still active, skipping');
    return;
  }
  _isRunning = true;

  try {
    console.log('[TOKEN-REFRESH] Starting token refresh');
    const results: RefreshResult[] = [];

    // Pass 1: Main shop tokens
    const shops = await getShopsNeedingRefresh();

    if (shops.length === 0) {
      console.log('[TOKEN-REFRESH] No shops need refresh');
    } else {
      console.log(`[TOKEN-REFRESH] ${shops.length} shops need refresh`);

      // Group by merchant_id
      const merchantGroups = new Map<number, ShopToken[]>();
      const standaloneShops: ShopToken[] = [];

      for (const shop of shops) {
        if (shop.merchant_id) {
          const group = merchantGroups.get(shop.merchant_id) || [];
          group.push(shop);
          merchantGroups.set(shop.merchant_id, group);
        } else {
          standaloneShops.push(shop);
        }
      }

      // Process merchant groups
      for (const [merchantId, groupShops] of merchantGroups) {
        const groupResults = await refreshMerchantGroup(merchantId, groupShops);
        results.push(...groupResults);
        await delay(DELAY_BETWEEN_SHOPS_MS);
      }

      // Process standalone shops in batches
      console.log(`[TOKEN-REFRESH] Processing ${standaloneShops.length} standalone shops`);
      const standaloneResults = await processBatch(standaloneShops, refreshStandaloneShop);
      results.push(...standaloneResults);
    }

    // Pass 2: Multi-app tokens
    try {
      const appResults = await refreshAppTokens();
      results.push(...appResults);
    } catch (err) {
      console.error('[TOKEN-REFRESH] App token refresh error:', (err as Error).message);
    }

    // Summary
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    console.log(`[TOKEN-REFRESH] Done: ${success} success, ${failed} failed, ${skipped} skipped (total ${results.length})`);

  } catch (error) {
    console.error('[TOKEN-REFRESH] Fatal error:', (error as Error).message);
  } finally {
    _isRunning = false;
  }
}
