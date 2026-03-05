/**
 * API Proxy - Gọi Shopee API và trả về response
 * Dùng cho tab API Response để test API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logApiCall, getApiCallStatus, createResponseSummary, extractUserFromJwt, determineTriggeredBy, type ApiCategory } from '../_shared/api-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';
const ADMIN_EMAIL = 'betacom.work@gmail.com';

// Partner-level API chỉ cho phép các endpoint này
const PARTNER_LEVEL_ALLOWED_PATHS = [
  '/api/v2/public/get_shops_by_partner',
  '/api/v2/public/get_merchants_by_partner',
  '/api/v2/public/get_shopee_ip_ranges',
];

/**
 * Gọi API qua VPS proxy hoặc trực tiếp
 */
async function fetchWithProxy(targetUrl: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    console.log('[API Proxy] Calling via proxy:', PROXY_URL);
    return await fetch(proxyUrl, options);
  }
  return await fetch(targetUrl, options);
}

// HMAC-SHA256 using Web Crypto API
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

/**
 * Detect API category from endpoint path
 */
function detectApiCategory(apiPath: string): ApiCategory {
  if (apiPath.includes('/product/')) return 'product';
  if (apiPath.includes('/flash_sale/') || apiPath.includes('/flash_deal/')) return 'flash_sale';
  if (apiPath.includes('/order/')) return 'order';
  if (apiPath.includes('/shop/')) return 'shop';
  if (apiPath.includes('/finance/') || apiPath.includes('/payment/')) return 'finance';
  if (apiPath.includes('/review/')) return 'review';
  if (apiPath.includes('/auth/') || apiPath.includes('/public/')) return 'auth';
  return 'shop'; // default
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      api_path,      // e.g. "/api/v2/product/get_item_base_info"
      method = 'GET',
      params = {},   // Query params
      body = null,   // Request body for POST
      shop_id,
      app_category,  // Optional: 'erp' - dùng credentials từ shop_app_tokens
      partner_app_id, // Optional: UUID từ apishopee_partner_apps - dùng cho partner-level API (không cần shop_id)
    } = await req.json();

    if (!api_path) {
      return new Response(
        JSON.stringify({ error: 'api_path is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract calling user from JWT (decode only, already verified by gateway)
    const { userId: callerUserId, userEmail: callerUserEmail } = extractUserFromJwt(req.headers.get('Authorization'));
    const triggeredBy = determineTriggeredBy({ userId: callerUserId, userEmail: callerUserEmail }, 'user');

    // Determine if this is a partner-level API call (no shop_id/access_token needed)
    const isPartnerLevel = !shop_id && partner_app_id;

    let access_token = '';
    let partner_id: number;
    let partner_key: string;

    if (isPartnerLevel) {
      // Partner-level API: chỉ admin mới được gọi
      if (!callerUserId) {
        return new Response(
          JSON.stringify({ error: 'Authorization header is required for partner-level API' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (callerUserEmail?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        console.warn(`[API Proxy] Partner-level access denied for: ${callerUserEmail}`);
        return new Response(
          JSON.stringify({ error: 'Forbidden: admin access required for partner-level API calls' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Kiểm tra api_path có trong allowlist không
      if (!PARTNER_LEVEL_ALLOWED_PATHS.includes(api_path)) {
        return new Response(
          JSON.stringify({ error: `API path "${api_path}" is not allowed for partner-level calls` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Partner-level API: lookup credentials from apishopee_partner_apps
      const { data: partnerApp, error: partnerError } = await supabase
        .from('apishopee_partner_apps')
        .select('partner_id, partner_key, partner_name, is_active')
        .eq('id', partner_app_id)
        .single();

      if (partnerError || !partnerApp) {
        return new Response(
          JSON.stringify({ error: 'Partner app not found', details: partnerError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!partnerApp.is_active) {
        return new Response(
          JSON.stringify({ error: 'Partner app is inactive' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      partner_id = partnerApp.partner_id;
      partner_key = partnerApp.partner_key;

      console.log(`[API Proxy] Partner-level call, partner: ${partnerApp.partner_name} (${partner_id})`);
    } else if (!shop_id) {
      return new Response(
        JSON.stringify({ error: 'shop_id or partner_app_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (app_category) {
      // Multi-app flow: lookup từ shop_app_tokens JOIN partner_apps
      const { data: appToken, error: appError } = await supabase
        .from('apishopee_shop_app_tokens')
        .select('access_token, apishopee_partner_apps!inner(partner_id, partner_key, app_category)')
        .eq('shop_id', shop_id)
        .eq('apishopee_partner_apps.app_category', app_category)
        .single();

      if (appError || !appToken) {
        return new Response(
          JSON.stringify({ error: `Chưa kết nối app "${app_category}" cho shop này. Vui lòng ủy quyền app trước.` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!appToken.access_token) {
        return new Response(
          JSON.stringify({ error: `Access token cho app "${app_category}" không tồn tại. Vui lòng ủy quyền lại.` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const appInfo = appToken.apishopee_partner_apps as unknown as { partner_id: number; partner_key: string };
      access_token = appToken.access_token;
      partner_id = appInfo.partner_id;
      partner_key = appInfo.partner_key;

      console.log(`[API Proxy] Using ${app_category} app credentials, partner_id: ${partner_id}`);
    } else {
      // Legacy flow: đọc từ apishopee_shops
      const { data: shop, error: shopError } = await supabase
        .from('apishopee_shops')
        .select('access_token, partner_id, partner_key')
        .eq('shop_id', shop_id)
        .single();

      if (shopError || !shop) {
        return new Response(
          JSON.stringify({ error: 'Shop not found', details: shopError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!shop.access_token) {
        return new Response(
          JSON.stringify({ error: 'Shop access_token not found. Please re-authorize.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!shop.partner_id || !shop.partner_key) {
        return new Response(
          JSON.stringify({ error: 'Partner credentials not found for this shop.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      access_token = shop.access_token;
      partner_id = shop.partner_id;
      partner_key = shop.partner_key;
    }

    // Build timestamp
    const timestamp = Math.floor(Date.now() / 1000);

    // Build base string for signature
    // Partner-level: partnerId + apiPath + timestamp
    // Shop-level: partnerId + apiPath + timestamp + accessToken + shopId
    const baseString = isPartnerLevel
      ? `${partner_id}${api_path}${timestamp}`
      : `${partner_id}${api_path}${timestamp}${access_token}${shop_id}`;
    const sign = await hmacSha256(partner_key, baseString);

    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.set('partner_id', partner_id.toString());
    queryParams.set('timestamp', timestamp.toString());
    queryParams.set('sign', sign);

    if (!isPartnerLevel) {
      queryParams.set('access_token', access_token);
      queryParams.set('shop_id', shop_id.toString());
    }

    // Add custom params
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          queryParams.set(key, String(value));
        }
      }
    }

    const url = `${SHOPEE_HOST}${api_path}?${queryParams.toString()}`;

    console.log(`[API Proxy] ${method} ${api_path} ${isPartnerLevel ? '(partner-level)' : `(shop: ${shop_id})`}`);
    console.log(`[API Proxy] Request body:`, body ? JSON.stringify(body) : 'null');

    // Make request to Shopee
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    let responseData: Record<string, unknown>;
    let httpStatus = 0;
    let httpStatusText = '';

    try {
      const response = await fetchWithProxy(url, fetchOptions);
      httpStatus = response.status;
      httpStatusText = response.statusText;
      responseData = await response.json();
    } catch (fetchErr) {
      const duration = Date.now() - startTime;
      console.error('[API Proxy] Fetch error:', fetchErr);
      // Log the failed call so it's never missed
      logApiCall(supabase, {
        shopId: shop_id || undefined,
        edgeFunction: 'apishopee-proxy',
        apiEndpoint: api_path,
        httpMethod: method,
        apiCategory: detectApiCategory(api_path),
        status: 'failed',
        shopeeError: 'network_error',
        shopeeMessage: (fetchErr as Error).message || 'Network request failed',
        durationMs: duration,
        requestParams: { ...params, ...(shop_id ? { shop_id } : {}) },
        userId: callerUserId,
        userEmail: callerUserEmail,
        triggeredBy,
      });
      return new Response(
        JSON.stringify({ error: (fetchErr as Error).message }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endTime = Date.now();

    // Log API call (non-blocking)
    const callStatus = getApiCallStatus(responseData);
    logApiCall(supabase, {
      shopId: shop_id || undefined,
      edgeFunction: 'apishopee-proxy',
      apiEndpoint: api_path,
      httpMethod: method,
      apiCategory: detectApiCategory(api_path),
      status: callStatus.status,
      shopeeError: callStatus.shopeeError,
      shopeeMessage: callStatus.shopeeMessage,
      httpStatusCode: httpStatus,
      durationMs: endTime - startTime,
      requestParams: { ...params, ...(shop_id ? { shop_id } : {}) },
      responseSummary: createResponseSummary(responseData),
      userId: callerUserId,
      userEmail: callerUserEmail,
      triggeredBy,
    });

    return new Response(
      JSON.stringify({
        request: {
          method,
          url: `${SHOPEE_HOST}${api_path}`,
          params: { ...params, ...(shop_id ? { shop_id } : {}), partner_id },
          body,
        },
        response: {
          status: httpStatus,
          statusText: httpStatusText,
          time_ms: endTime - startTime,
          data: responseData,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('[API Proxy] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
