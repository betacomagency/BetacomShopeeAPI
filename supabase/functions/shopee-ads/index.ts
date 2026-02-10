/**
 * Supabase Edge Function: Shopee Ads API Proxy
 * Dedicated proxy cho Shopee Ads API - luôn dùng credentials từ Betacom Ads app
 * Credentials lấy từ apishopee_shop_app_tokens JOIN apishopee_partner_apps WHERE app_category = 'ads'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logApiCall, getApiCallStatus } from '../_shared/api-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';

/**
 * Gọi API qua VPS proxy hoặc trực tiếp
 */
async function fetchWithProxy(targetUrl: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    console.log('[SHOPEE-ADS] Calling via proxy:', PROXY_URL);
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

interface AdsCredentials {
  access_token: string;
  partner_id: number;
  partner_key: string;
}

/**
 * Lấy Ads app credentials cho shop từ shop_app_tokens
 */
async function getAdsCredentials(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<AdsCredentials | null> {
  const { data, error } = await supabase
    .from('apishopee_shop_app_tokens')
    .select('access_token, apishopee_partner_apps!inner(partner_id, partner_key, app_category)')
    .eq('shop_id', shopId)
    .eq('apishopee_partner_apps.app_category', 'ads')
    .single();

  if (error || !data || !data.access_token) {
    console.error('[SHOPEE-ADS] No ads credentials for shop:', shopId, error);
    return null;
  }

  const appInfo = data.apishopee_partner_apps as unknown as {
    partner_id: number;
    partner_key: string;
  };

  return {
    access_token: data.access_token,
    partner_id: appInfo.partner_id,
    partner_key: appInfo.partner_key,
  };
}

/**
 * Gọi Shopee Ads API với signed request
 */
async function callShopeeAdsApi(
  creds: AdsCredentials,
  shopId: number,
  apiPath: string,
  method: string,
  bodyData?: Record<string, unknown>,
  queryParams?: Record<string, unknown>
): Promise<{ request: Record<string, unknown>; response: Record<string, unknown> }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${creds.partner_id}${apiPath}${timestamp}${creds.access_token}${shopId}`;
  const sign = await hmacSha256(creds.partner_key, baseString);

  const params = new URLSearchParams();
  params.set('partner_id', creds.partner_id.toString());
  params.set('timestamp', timestamp.toString());
  params.set('access_token', creds.access_token);
  params.set('shop_id', shopId.toString());
  params.set('sign', sign);

  // Add query params
  if (queryParams && typeof queryParams === 'object') {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
  }

  const url = `${SHOPEE_HOST}${apiPath}?${params.toString()}`;

  console.log(`[SHOPEE-ADS] ${method} ${apiPath} for shop ${shopId}`);

  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (bodyData && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(bodyData);
  }

  const startTime = Date.now();
  const response = await fetchWithProxy(url, fetchOptions);
  const endTime = Date.now();
  const responseData = await response.json();

  return {
    request: {
      method,
      url: `${SHOPEE_HOST}${apiPath}`,
      params: { ...queryParams, shop_id: shopId, partner_id: creds.partner_id },
      body: bodyData,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      time_ms: endTime - startTime,
      data: responseData,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      action,
      api_path,
      method = 'POST',
      params = {},
      body = null,
      shop_id,
    } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: 'shop_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Always get ads-specific credentials
    const creds = await getAdsCredentials(supabase, shop_id);
    if (!creds) {
      return new Response(
        JSON.stringify({
          error: 'Shop chưa kết nối Ads App. Vui lòng ủy quyền Betacom Ads trước khi sử dụng tính năng quảng cáo.',
          code: 'ADS_APP_NOT_AUTHORIZED',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    switch (action) {
      case 'get-campaigns': {
        // Lấy danh sách tất cả ads campaigns
        result = await callShopeeAdsApi(creds, shop_id, '/api/v2/ads/get_all_ads', 'POST', {
          page_size: params.page_size || 100,
          offset: params.offset || 0,
        });
        break;
      }

      case 'get-campaign-detail': {
        // Lấy chi tiết campaign
        if (!params.campaign_id) {
          return new Response(
            JSON.stringify({ error: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await callShopeeAdsApi(creds, shop_id, '/api/v2/ads/get_ads_detail', 'POST', {
          campaign_id: params.campaign_id,
        });
        break;
      }

      case 'update-budget': {
        // Cập nhật ngân sách chiến dịch
        if (!body?.campaign_id || body?.daily_budget === undefined) {
          return new Response(
            JSON.stringify({ error: 'campaign_id and daily_budget are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await callShopeeAdsApi(creds, shop_id, '/api/v2/ads/update_campaign_daily_budget', 'POST', {
          campaign_id: body.campaign_id,
          daily_budget: body.daily_budget,
        });
        break;
      }

      case 'toggle-campaign': {
        // Bật/tắt chiến dịch
        if (!body?.campaign_id || !body?.action) {
          return new Response(
            JSON.stringify({ error: 'campaign_id and action (activate/pause) are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await callShopeeAdsApi(creds, shop_id, '/api/v2/ads/update_campaign_status', 'POST', {
          campaign_id: body.campaign_id,
          action: body.action,
        });
        break;
      }

      default: {
        // Generic proxy mode - forward bất kỳ Ads API nào
        if (!api_path) {
          return new Response(
            JSON.stringify({ error: 'action or api_path is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await callShopeeAdsApi(creds, shop_id, api_path, method, body, params);
      }
    }

    // Log API call
    const apiPath = action
      ? `/api/v2/ads/${action.replace(/-/g, '_')}`
      : api_path;
    const apiResult = result.response as { data?: { error?: string; message?: string } };
    const shopeeStatus = getApiCallStatus(apiResult.data || {});
    logApiCall(supabase, {
      shopId: shop_id,
      edgeFunction: 'shopee-ads',
      apiEndpoint: apiPath,
      httpMethod: method,
      apiCategory: 'ads',
      status: shopeeStatus.status,
      shopeeError: shopeeStatus.shopeeError,
      shopeeMessage: shopeeStatus.shopeeMessage,
      durationMs: (result.response as { time_ms?: number }).time_ms || 0,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[SHOPEE-ADS] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
