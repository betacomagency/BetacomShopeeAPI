/**
 * Supabase Edge Function: Lazada Authentication
 * Xử lý OAuth flow với Lazada Open Platform API
 *
 * Lazada API Documentation: https://open.lazada.com/
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lazada API config
const DEFAULT_APP_KEY = Deno.env.get('LAZADA_APP_KEY') || '';
const DEFAULT_APP_SECRET = Deno.env.get('LAZADA_APP_SECRET') || '';

// Lazada OAuth endpoint (unified for all regions)
const LAZADA_AUTH_URL = 'https://auth.lazada.com';

const LAZADA_API_URLS: Record<string, string> = {
  VN: 'https://api.lazada.vn/rest',
  TH: 'https://api.lazada.co.th/rest',
  MY: 'https://api.lazada.com.my/rest',
  SG: 'https://api.lazada.sg/rest',
  PH: 'https://api.lazada.com.ph/rest',
  ID: 'https://api.lazada.co.id/rest',
};

// Supabase config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Interfaces
interface AppCredentials {
  appKey: string;
  appSecret: string;
  appName?: string;
  appCreatedBy?: string;
}

interface AppInfo {
  app_key: string;
  app_secret: string;
  app_name?: string;
  app_created_by?: string;
}

/**
 * Lấy app credentials từ request hoặc shop hoặc fallback env
 */
async function getAppCredentials(
  supabase: ReturnType<typeof createClient>,
  appInfo?: AppInfo,
  sellerId?: number
): Promise<AppCredentials> {
  // Nếu có app_info từ request, dùng trực tiếp
  if (appInfo?.app_key && appInfo?.app_secret) {
    console.log('[LAZADA] Using app credentials from request:', appInfo.app_key);
    return {
      appKey: appInfo.app_key,
      appSecret: appInfo.app_secret,
      appName: appInfo.app_name,
      appCreatedBy: appInfo.app_created_by,
    };
  }

  // Nếu có seller_id, lấy credentials từ shop
  if (sellerId) {
    const { data, error } = await supabase
      .from('apilazada_shops')
      .select('app_key, app_secret, app_name')
      .eq('seller_id', sellerId)
      .single();

    if (data?.app_key && data?.app_secret && !error) {
      console.log('[LAZADA] Using app credentials from shop:', data.app_key);
      return {
        appKey: data.app_key,
        appSecret: data.app_secret,
        appName: data.app_name,
      };
    }
  }

  // Fallback: dùng env
  console.log('[LAZADA] Using default app credentials from env:', DEFAULT_APP_KEY);
  return {
    appKey: DEFAULT_APP_KEY,
    appSecret: DEFAULT_APP_SECRET,
  };
}

/**
 * Tạo signature cho Lazada API
 * Lazada signature = HMAC-SHA256(app_secret, sorted_params_string).toUpperCase()
 */
function createSignature(
  appSecret: string,
  apiPath: string,
  params: Record<string, string>
): string {
  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();

  // Build the string to sign: /api/path + key1value1 + key2value2 + ...
  let signString = apiPath;
  for (const key of sortedKeys) {
    signString += key + params[key];
  }

  console.log('[LAZADA] Sign string:', signString);

  // Create HMAC-SHA256 signature
  const hmac = createHmac('sha256', appSecret);
  hmac.update(signString);
  const signature = hmac.digest('hex').toUpperCase();

  return signature;
}

/**
 * Tạo URL xác thực OAuth
 */
function getAuthUrl(
  credentials: AppCredentials,
  redirectUri: string,
  region: string = 'VN'
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    force_auth: 'true',
    redirect_uri: redirectUri,
    client_id: credentials.appKey,
    country: region, // Lazada uses country param to determine region
  });

  return `${LAZADA_AUTH_URL}/oauth/authorize?${params.toString()}`;
}

/**
 * Đổi authorization code lấy access token
 */
async function getAccessToken(
  credentials: AppCredentials,
  code: string,
  region: string = 'VN'
) {
  const apiBaseUrl = LAZADA_API_URLS[region] || LAZADA_API_URLS.VN;
  const apiPath = '/auth/token/create';
  const timestamp = Date.now().toString();

  // Parameters for signing
  const params: Record<string, string> = {
    app_key: credentials.appKey,
    timestamp: timestamp,
    sign_method: 'sha256',
    code: code,
  };

  // Create signature
  const sign = createSignature(credentials.appSecret, apiPath, params);
  params.sign = sign;

  // Build URL with params
  const queryString = new URLSearchParams(params).toString();
  const url = `${apiBaseUrl}${apiPath}?${queryString}`;

  console.log('[LAZADA] Getting access token from:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();
  console.log('[LAZADA] Token response:', JSON.stringify(result, null, 2));

  return result;
}

/**
 * Refresh access token
 */
async function refreshAccessToken(
  credentials: AppCredentials,
  refreshToken: string,
  region: string = 'VN'
) {
  const apiBaseUrl = LAZADA_API_URLS[region] || LAZADA_API_URLS.VN;
  const apiPath = '/auth/token/refresh';
  const timestamp = Date.now().toString();

  // Parameters for signing
  const params: Record<string, string> = {
    app_key: credentials.appKey,
    timestamp: timestamp,
    sign_method: 'sha256',
    refresh_token: refreshToken,
  };

  // Create signature
  const sign = createSignature(credentials.appSecret, apiPath, params);
  params.sign = sign;

  // Build URL with params
  const queryString = new URLSearchParams(params).toString();
  const url = `${apiBaseUrl}${apiPath}?${queryString}`;

  console.log('[LAZADA] Refreshing token from:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await response.json();
}

/**
 * Extract seller_id từ Lazada token response
 * Lazada trả về seller_id trong country_user_info array
 */
function extractSellerId(token: Record<string, unknown>): number | null {
  // Cách 1: Từ country_user_info array (Lazada v2 API)
  const countryUserInfo = token.country_user_info as Array<{
    country: string;
    user_id: string | number;
    seller_id?: string | number;
    short_code?: string;
  }> | undefined;

  if (countryUserInfo && countryUserInfo.length > 0) {
    const firstUserInfo = countryUserInfo[0];
    // Ưu tiên seller_id, fallback to user_id
    const sellerId = firstUserInfo.seller_id || firstUserInfo.user_id;
    return typeof sellerId === 'string' ? parseInt(sellerId, 10) : sellerId;
  }

  // Cách 2: Trực tiếp từ token (nếu Lazada trả về ở top-level)
  if (token.user_id) {
    return typeof token.user_id === 'string'
      ? parseInt(token.user_id as string, 10)
      : token.user_id as number;
  }

  return null;
}

/**
 * Lưu token vào Supabase
 */
async function saveToken(
  supabase: ReturnType<typeof createClient>,
  token: Record<string, unknown>,
  region: string,
  userId?: string,
  appInfo?: AppCredentials
) {
  const now = new Date();

  // Extract seller_id from token response
  const sellerId = extractSellerId(token);

  if (!sellerId) {
    console.error('[LAZADA] Cannot extract seller_id from token response:', JSON.stringify(token, null, 2));
    throw new Error('Cannot extract seller_id from Lazada response');
  }

  console.log('[LAZADA] Extracted seller_id:', sellerId);

  // Lazada returns expires_in in seconds (usually 604800 = 7 days for access token)
  const accessTokenExpiresAt = new Date(now.getTime() + (token.expires_in as number) * 1000);

  // Refresh token expires in 30 days (Lazada default)
  const refreshTokenExpiresAt = token.refresh_expires_in
    ? new Date(now.getTime() + (token.refresh_expires_in as number) * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Extract short_code từ country_user_info nếu có
  let shortCode = token.account as string | undefined;
  const countryUserInfo = token.country_user_info as Array<{ short_code?: string }> | undefined;
  if (countryUserInfo && countryUserInfo.length > 0 && countryUserInfo[0].short_code) {
    shortCode = countryUserInfo[0].short_code;
  }

  const shopData: Record<string, unknown> = {
    seller_id: sellerId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    access_token_expires_at: accessTokenExpiresAt.toISOString(),
    refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
    token_updated_at: now.toISOString(),
    region: region,
    country: token.country,
    short_code: shortCode,
  };

  // Thêm account platform info nếu có
  if (token.account_platform) {
    shopData.seller_type = token.account_platform;
  }

  // Thêm app info nếu có
  if (appInfo) {
    shopData.app_key = appInfo.appKey;
    shopData.app_secret = appInfo.appSecret;
    if (appInfo.appName) {
      shopData.app_name = appInfo.appName;
    }
    if (appInfo.appCreatedBy) {
      shopData.app_created_by = appInfo.appCreatedBy;
    }
  }

  console.log('[LAZADA] Saving token for seller:', sellerId);

  const { error } = await supabase.from('apilazada_shops').upsert(shopData, {
    onConflict: 'seller_id',
  });

  if (error) {
    console.error('[LAZADA] Failed to save token:', error);
    throw error;
  }

  console.log('[LAZADA] Token saved successfully');

  // Return seller_id for use in caller
  return sellerId;
}

/**
 * Lấy token từ Supabase
 */
async function getToken(supabase: ReturnType<typeof createClient>, sellerId: number) {
  const { data, error } = await supabase
    .from('apilazada_shops')
    .select('*')
    .eq('seller_id', sellerId)
    .single();

  if (error) {
    console.error('[LAZADA] Failed to get token:', error);
    return null;
  }

  return data;
}

/**
 * Kiểm tra token có hết hạn chưa (với buffer 1 giờ)
 */
function isTokenExpired(expiresAt: string | null, bufferMinutes: number = 60): boolean {
  if (!expiresAt) return true;

  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferMs = bufferMinutes * 60 * 1000;

  return now >= expiryTime - bufferMs;
}

/**
 * Lấy valid access token, tự động refresh nếu cần
 */
async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  sellerId: number
): Promise<{ access_token: string; error?: string } | null> {
  const shop = await getToken(supabase, sellerId);

  if (!shop) {
    return { access_token: '', error: 'Shop not found' };
  }

  // Kiểm tra access token còn hạn không (buffer 1 giờ)
  if (!isTokenExpired(shop.access_token_expires_at, 60)) {
    console.log('[LAZADA] Access token still valid');
    return { access_token: shop.access_token };
  }

  console.log('[LAZADA] Access token expired or expiring soon, checking refresh token...');

  // Kiểm tra refresh token còn hạn không
  if (isTokenExpired(shop.refresh_token_expires_at, 0)) {
    console.error('[LAZADA] Refresh token expired, need re-authorization');
    // Update shop status
    await supabase
      .from('apilazada_shops')
      .update({ status: 'token_expired' })
      .eq('seller_id', sellerId);

    return { access_token: '', error: 'Refresh token expired, please re-authorize' };
  }

  // Refresh token
  console.log('[LAZADA] Refreshing access token...');
  const credentials: AppCredentials = {
    appKey: shop.app_key || DEFAULT_APP_KEY,
    appSecret: shop.app_secret || DEFAULT_APP_SECRET,
  };

  try {
    const newToken = await refreshAccessToken(credentials, shop.refresh_token, shop.region || 'VN');

    if (newToken.code && newToken.code !== '0') {
      console.error('[LAZADA] Failed to refresh token:', newToken.message);

      // Nếu refresh thất bại, đánh dấu cần re-auth
      await supabase
        .from('apilazada_shops')
        .update({ status: 'token_expired' })
        .eq('seller_id', sellerId);

      return { access_token: '', error: newToken.message || 'Failed to refresh token' };
    }

    // Lưu token mới
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + (newToken.expires_in as number) * 1000);
    const refreshTokenExpiresAt = newToken.refresh_expires_in
      ? new Date(now.getTime() + (newToken.refresh_expires_in as number) * 1000)
      : shop.refresh_token_expires_at; // Keep old expiry if not provided

    await supabase
      .from('apilazada_shops')
      .update({
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token || shop.refresh_token,
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt,
        token_updated_at: now.toISOString(),
        status: 'active',
      })
      .eq('seller_id', sellerId);

    console.log('[LAZADA] Token refreshed successfully');
    return { access_token: newToken.access_token as string };
  } catch (error) {
    console.error('[LAZADA] Error refreshing token:', error);
    return { access_token: '', error: (error as Error).message };
  }
}

/**
 * Lấy thông tin seller từ Lazada API
 */
async function getSellerInfo(
  credentials: AppCredentials,
  accessToken: string,
  region: string = 'VN'
) {
  const apiBaseUrl = LAZADA_API_URLS[region] || LAZADA_API_URLS.VN;
  const apiPath = '/seller/get';
  const timestamp = Date.now().toString();

  const params: Record<string, string> = {
    app_key: credentials.appKey,
    timestamp: timestamp,
    sign_method: 'sha256',
    access_token: accessToken,
  };

  const sign = createSignature(credentials.appSecret, apiPath, params);
  params.sign = sign;

  const queryString = new URLSearchParams(params).toString();
  const url = `${apiBaseUrl}${apiPath}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return await response.json();
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const region = body.region || 'VN';

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get user from auth header (optional)
    const authHeader = req.headers.get('Authorization');
    let userId: string | undefined;

    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id;
    }

    switch (action) {
      case 'get-auth-url': {
        const redirectUri = body.redirect_uri || '';
        const appInfo = body.app_info as AppInfo | undefined;

        const credentials = await getAppCredentials(supabase, appInfo);
        const authUrl = getAuthUrl(credentials, redirectUri, region);

        return new Response(JSON.stringify({
          auth_url: authUrl,
          app_key: credentials.appKey,
          region: region,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-token': {
        const code = body.code || '';
        const appInfo = body.app_info as AppInfo | undefined;
        const sellerId = body.seller_id ? Number(body.seller_id) : undefined;

        console.log('[LAZADA] get-token request:', {
          code: code.substring(0, 20) + '...',
          codeLength: code.length,
          region,
          hasAppInfo: !!appInfo
        });

        const credentials = await getAppCredentials(supabase, appInfo, sellerId);
        console.log('[LAZADA] Using credentials app_key:', credentials.appKey);

        const token = await getAccessToken(credentials, code, region);
        console.log('[LAZADA] Token API response:', {
          code: token.code,
          message: token.message,
          hasAccessToken: !!token.access_token,
          hasRefreshToken: !!token.refresh_token,
          userId: token.user_id,
          expiresIn: token.expires_in,
          country: token.country
        });

        if (token.code && token.code !== '0') {
          console.error('[LAZADA] Token exchange failed:', token.code, token.message);
          return new Response(JSON.stringify({
            error: token.code,
            message: token.message,
            success: false
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Save token to database
        let savedSellerId: number;
        try {
          savedSellerId = await saveToken(supabase, token, region, userId, credentials);
          console.log('[LAZADA] Token saved successfully for seller:', savedSellerId);
        } catch (saveError) {
          console.error('[LAZADA] Failed to save token:', saveError);
          return new Response(JSON.stringify({
            error: 'database_error',
            message: (saveError as Error).message,
            success: false
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Try to get seller info
        try {
          const sellerInfo = await getSellerInfo(credentials, token.access_token as string, region);
          console.log('[LAZADA] Seller info:', sellerInfo);
          if (sellerInfo.data) {
            // Update shop with seller info
            await supabase.from('apilazada_shops').update({
              shop_name: sellerInfo.data.name || sellerInfo.data.short_code,
              email: sellerInfo.data.email,
              seller_status: sellerInfo.data.status,
            }).eq('seller_id', savedSellerId);
            console.log('[LAZADA] Shop updated with seller info');
          }
        } catch (e) {
          console.error('[LAZADA] Failed to get seller info:', e);
        }

        console.log('[LAZADA] get-token completed successfully');
        return new Response(JSON.stringify({
          ...token,
          user_id: savedSellerId, // Ensure user_id is in response for frontend
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'refresh-token': {
        const { refresh_token, seller_id } = body;
        const appInfo = body.app_info as AppInfo | undefined;

        const credentials = await getAppCredentials(supabase, appInfo, seller_id);
        const token = await refreshAccessToken(credentials, refresh_token, region);

        if (token.code && token.code !== '0') {
          return new Response(JSON.stringify({
            error: token.code,
            message: token.message,
            success: false
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update token in database
        await saveToken(supabase, { ...token, user_id: seller_id }, region, userId, credentials);

        return new Response(JSON.stringify({
          ...token,
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-stored-token': {
        const sellerId = Number(body.seller_id);

        if (!sellerId) {
          return new Response(JSON.stringify({
            error: 'seller_id is required',
            success: false
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const token = await getToken(supabase, sellerId);

        return new Response(JSON.stringify(token || { error: 'Token not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-seller-info': {
        const sellerId = Number(body.seller_id);
        const appInfo = body.app_info as AppInfo | undefined;

        const credentials = await getAppCredentials(supabase, appInfo, sellerId);
        const shop = await getToken(supabase, sellerId);

        if (!shop?.access_token) {
          return new Response(JSON.stringify({
            error: 'No access token found',
            success: false
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const sellerInfo = await getSellerInfo(credentials, shop.access_token, shop.region || 'VN');

        return new Response(JSON.stringify(sellerInfo), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-valid-token': {
        // Lấy valid access token với auto-refresh
        const sellerId = Number(body.seller_id);

        if (!sellerId) {
          return new Response(JSON.stringify({
            error: 'seller_id is required',
            success: false
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await getValidAccessToken(supabase, sellerId);

        if (!result || result.error) {
          return new Response(JSON.stringify({
            error: result?.error || 'Failed to get valid token',
            success: false,
            need_reauth: result?.error?.includes('expired') || result?.error?.includes('re-authorize')
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          access_token: result.access_token,
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'check-token-status': {
        // Kiểm tra trạng thái token của một hoặc nhiều shops
        const sellerIds = body.seller_ids as number[] | undefined;

        if (!sellerIds || sellerIds.length === 0) {
          // Kiểm tra tất cả shops
          const { data: shops } = await supabase
            .from('apilazada_shops')
            .select('seller_id, shop_name, access_token_expires_at, refresh_token_expires_at, status');

          const results = (shops || []).map((shop) => ({
            seller_id: shop.seller_id,
            shop_name: shop.shop_name,
            access_token_expired: isTokenExpired(shop.access_token_expires_at, 0),
            access_token_expiring_soon: isTokenExpired(shop.access_token_expires_at, 60),
            refresh_token_expired: isTokenExpired(shop.refresh_token_expires_at, 0),
            status: shop.status,
          }));

          return new Response(JSON.stringify({
            shops: results,
            success: true,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Kiểm tra shops cụ thể
        const { data: shops } = await supabase
          .from('apilazada_shops')
          .select('seller_id, shop_name, access_token_expires_at, refresh_token_expires_at, status')
          .in('seller_id', sellerIds);

        const results = (shops || []).map((shop) => ({
          seller_id: shop.seller_id,
          shop_name: shop.shop_name,
          access_token_expired: isTokenExpired(shop.access_token_expires_at, 0),
          access_token_expiring_soon: isTokenExpired(shop.access_token_expires_at, 60),
          refresh_token_expired: isTokenExpired(shop.refresh_token_expires_at, 0),
          status: shop.status,
        }));

        return new Response(JSON.stringify({
          shops: results,
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'refresh-all-expiring': {
        // Refresh tất cả tokens sắp hết hạn (dùng cho cron job)
        const bufferHours = body.buffer_hours || 24; // Default: refresh nếu còn < 24 giờ

        const { data: shops } = await supabase
          .from('apilazada_shops')
          .select('*')
          .eq('status', 'active');

        const results: Array<{ seller_id: number; success: boolean; error?: string }> = [];

        for (const shop of shops || []) {
          // Chỉ refresh nếu access token sắp hết hạn
          if (!isTokenExpired(shop.access_token_expires_at, bufferHours * 60)) {
            continue;
          }

          console.log(`[LAZADA] Refreshing token for shop ${shop.seller_id}...`);

          const result = await getValidAccessToken(supabase, shop.seller_id);

          results.push({
            seller_id: shop.seller_id,
            success: !result?.error,
            error: result?.error,
          });
        }

        return new Response(JSON.stringify({
          refreshed: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          error: 'Invalid action',
          success: false
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[LAZADA] Error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      success: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
