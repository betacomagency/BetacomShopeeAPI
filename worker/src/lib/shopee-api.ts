/**
 * Shopee API client for Node.js worker.
 * Ported from Supabase Edge Functions — replaces Deno crypto + proxy with Node.js native.
 * Calls Shopee API directly from EC2 (fixed IP, no proxy needed).
 */
import { createHmac } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { getLimiter } from './rate-limiter';
import { logApiCall, getApiCallStatus, createResponseSummary } from '../utils/api-logger';

// ==================== TYPES ====================

export interface PartnerCredentials {
  partnerId: number;
  partnerKey: string;
}

export interface ShopToken {
  access_token: string;
  refresh_token: string;
}

interface CallShopeeApiOptions {
  supabase: SupabaseClient;
  credentials: PartnerCredentials;
  path: string;
  method: 'GET' | 'POST';
  shopId: number;
  token: ShopToken;
  body?: Record<string, unknown>;
  extraParams?: Record<string, string | number | boolean>;
  /** Edge function name for logging purposes */
  edgeFunction?: string;
  apiCategory?: string;
  triggeredBy?: 'user' | 'cron' | 'scheduler' | 'webhook' | 'system';
}

// ==================== SIGNING ====================

/**
 * Generate HMAC-SHA256 signature for Shopee API.
 * Base string format: partnerId + apiPath + timestamp [+ accessToken] [+ shopId]
 */
export function createSignature(
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
  return createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

// ==================== CREDENTIALS ====================

/**
 * Get partner credentials for a shop from DB.
 * Falls back to env vars if shop doesn't have per-shop credentials.
 */
export async function getPartnerCredentials(
  supabase: SupabaseClient,
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

  // Fallback: should not happen in production, but safe default
  throw new Error(`No partner credentials found for shop ${shopId}`);
}

/**
 * Get shop token from DB. Throws if not found.
 */
export async function getShopToken(
  supabase: SupabaseClient,
  shopId: number
): Promise<ShopToken & { refresh_token: string }> {
  const { data } = await supabase
    .from('apishopee_shops')
    .select('access_token, refresh_token, expired_at')
    .eq('shop_id', shopId)
    .single();

  if (data?.access_token) {
    return { access_token: data.access_token, refresh_token: data.refresh_token };
  }
  throw new Error(`Token not found for shop ${shopId}`);
}

// ==================== TOKEN REFRESH ====================

/**
 * Refresh access token via Shopee Auth API.
 * Auth-level signing: baseString = partnerId + path + timestamp (no token/shopId).
 */
export async function refreshAccessToken(
  credentials: PartnerCredentials,
  refreshToken: string,
  shopId: number
): Promise<Record<string, unknown>> {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/auth/access_token/get';
  const sign = createSignature(credentials.partnerKey, credentials.partnerId, path, timestamp);
  const url = `${config.shopeeBaseUrl}${path}?partner_id=${credentials.partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      partner_id: credentials.partnerId,
      shop_id: shopId,
    }),
  });
  return await response.json() as Record<string, unknown>;
}

/**
 * Save refreshed token to DB. Logs error but does not throw — caller handles fallback.
 */
export async function saveToken(
  supabase: SupabaseClient,
  shopId: number,
  token: Record<string, unknown>
): Promise<boolean> {
  const expireIn = token.expire_in as number;
  const expiredAt = new Date(Date.now() + expireIn * 1000).toISOString();

  const { error } = await supabase.from('apishopee_shops').upsert({
    shop_id: shopId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expire_in: expireIn,
    expired_at: expiredAt,
    token_updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id' });

  if (error) {
    console.error(`[SHOPEE-API] Failed to save token for shop ${shopId}:`, error.message);
    return false;
  }
  return true;
}

// ==================== API CALLER ====================

/**
 * Call Shopee API with signing, rate limiting, auto token refresh on auth failure.
 * Direct HTTPS from EC2 — no proxy.
 */
export async function callShopeeApi(opts: CallShopeeApiOptions): Promise<unknown> {
  const {
    supabase, credentials, path, method, shopId, token,
    body, extraParams, edgeFunction, apiCategory, triggeredBy,
  } = opts;

  const startTime = Date.now();
  let wasTokenRefreshed = false;

  // Use rate limiter keyed by partner app
  const limiter = getLimiter(credentials.partnerId.toString());

  const logCall = (status: 'success' | 'failed' | 'timeout', duration: number, extra?: {
    shopeeError?: string; shopeeMessage?: string; responseSummary?: Record<string, unknown>;
  }) => {
    logApiCall(supabase, {
      shopId,
      partnerId: credentials.partnerId,
      edgeFunction: edgeFunction || 'worker',
      apiEndpoint: path,
      httpMethod: method,
      apiCategory: (apiCategory || 'flash_sale') as 'flash_sale',
      status,
      shopeeError: extra?.shopeeError,
      shopeeMessage: extra?.shopeeMessage,
      durationMs: duration,
      responseSummary: extra?.responseSummary,
      wasTokenRefreshed,
      triggeredBy,
    });
  };

  const makeRequest = async (accessToken: string) => {
    return limiter.schedule(async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = createSignature(credentials.partnerKey, credentials.partnerId, path, timestamp, accessToken, shopId);

      const params = new URLSearchParams({
        partner_id: credentials.partnerId.toString(),
        timestamp: timestamp.toString(),
        access_token: accessToken,
        shop_id: shopId.toString(),
        sign,
      });

      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          if (value !== undefined && value !== null) {
            params.append(key, value.toString());
          }
        }
      }

      const url = `${config.shopeeBaseUrl}${path}?${params.toString()}`;
      const fetchOpts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30s timeout
      };
      if (method === 'POST' && body) {
        fetchOpts.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, fetchOpts);
        return await response.json();
      } catch (fetchError) {
        const err = fetchError as Error;
        return { error: 'network_error', message: err.message || 'Network request failed' };
      }
    });
  };

  try {
    let result = await makeRequest(token.access_token) as Record<string, unknown>;

    // Auto-refresh token on auth failure (no mutation of original token object)
    if (result.error === 'error_auth' || (result.message as string)?.includes?.('Invalid access_token')) {
      const firstStatus = getApiCallStatus(result);
      logCall(firstStatus.status, Date.now() - startTime, {
        shopeeError: firstStatus.shopeeError,
        shopeeMessage: firstStatus.shopeeMessage,
        responseSummary: createResponseSummary(result),
      });

      console.log(`[SHOPEE-API] Token invalid for shop ${shopId}, refreshing...`);
      const retryStart = Date.now();
      const newToken = await refreshAccessToken(credentials, token.refresh_token, shopId);
      if (!newToken.error) {
        const saved = await saveToken(supabase, shopId, newToken);
        if (!saved) {
          console.warn(`[SHOPEE-API] Token refreshed but failed to persist for shop ${shopId}`);
        }
        wasTokenRefreshed = true;
        // Use new token for retry without mutating the original token object
        result = await makeRequest(newToken.access_token as string) as Record<string, unknown>;
      }

      const retryStatus = getApiCallStatus(result);
      logCall(retryStatus.status, Date.now() - retryStart, {
        shopeeError: retryStatus.shopeeError,
        shopeeMessage: retryStatus.shopeeMessage,
        responseSummary: createResponseSummary(result),
      });

      return result;
    }

    // Log successful/failed call
    const apiStatus = getApiCallStatus(result);
    logCall(apiStatus.status, Date.now() - startTime, {
      shopeeError: apiStatus.shopeeError,
      shopeeMessage: apiStatus.shopeeMessage,
      responseSummary: createResponseSummary(result),
    });

    return result;
  } catch (err) {
    logCall('failed', Date.now() - startTime, {
      shopeeError: 'worker_error',
      shopeeMessage: (err as Error).message || 'Unexpected error',
    });
    throw err;
  }
}
