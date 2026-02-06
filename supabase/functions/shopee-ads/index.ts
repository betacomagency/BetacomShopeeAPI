/**
 * Supabase Edge Function: Shopee Ads
 * API quản lý chiến dịch quảng cáo Shopee
 *
 * Actions:
 * - get-campaign-id-list: Lấy danh sách campaign IDs
 * - get-campaign-setting-info: Lấy thông tin chi tiết campaigns
 * - edit-manual-product-ads: Chỉnh sửa Manual Product Ads
 * - edit-auto-product-ads: Chỉnh sửa Auto Product Ads
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetch with proxy support for static IP
 * Supabase Edge Functions không có static IP, cần route qua proxy server
 */
async function fetchWithProxy(
  targetUrl: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions = { ...options, signal: controller.signal };

    if (PROXY_URL) {
      // Route through proxy server with static IP
      const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
      console.log('[shopee-ads] Using proxy:', PROXY_URL);
      return await fetch(proxyUrl, fetchOptions);
    }

    // Direct fetch (will fail if IP not whitelisted)
    console.log('[shopee-ads] Warning: No PROXY_URL configured, calling Shopee directly');
    return await fetch(targetUrl, fetchOptions);
  } finally {
    clearTimeout(timeoutId);
  }
}

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

async function getShopCredentials(supabase: ReturnType<typeof createClient>, shopId: number) {
  const { data: shop, error } = await supabase
    .from('apishopee_shops')
    .select('access_token, partner_id, partner_key')
    .eq('shop_id', shopId)
    .single();

  if (error || !shop) {
    throw new Error('Shop not found');
  }

  if (!shop.access_token) {
    throw new Error('Shop access_token not found. Please re-authorize.');
  }

  if (!shop.partner_id || !shop.partner_key) {
    throw new Error('Partner credentials not found for this shop.');
  }

  return shop;
}

async function callShopeeAPI(
  partnerId: number,
  partnerKey: string,
  accessToken: string,
  shopId: number,
  apiPath: string,
  method: 'GET' | 'POST',
  params?: Record<string, string | number>,
  body?: Record<string, unknown>
) {
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

  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body && method === 'POST') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetchWithProxy(url, fetchOptions);
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, shop_id, ...params } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!shop_id) {
      return new Response(
        JSON.stringify({ error: 'shop_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const shop = await getShopCredentials(supabase, shop_id);
    const { access_token, partner_id, partner_key } = shop;

    let result;

    switch (action) {
      case 'get-campaign-id-list': {
        result = await callShopeeAPI(
          partner_id,
          partner_key,
          access_token,
          shop_id,
          '/api/v2/ads/get_product_level_campaign_id_list',
          'GET',
          {
            ad_type: params.ad_type || 'all',
            offset: params.offset ?? 0,
            limit: params.limit ?? 5000,
          }
        );
        break;
      }

      case 'get-campaign-setting-info': {
        if (!params.campaign_id_list) {
          return new Response(
            JSON.stringify({ error: 'campaign_id_list is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        result = await callShopeeAPI(
          partner_id,
          partner_key,
          access_token,
          shop_id,
          '/api/v2/ads/get_product_level_campaign_setting_info',
          'GET',
          {
            campaign_id_list: params.campaign_id_list,
            info_type_list: params.info_type_list || '1,3',
          }
        );
        break;
      }

      case 'edit-manual-product-ads': {
        if (!params.campaign_id || !params.edit_action) {
          return new Response(
            JSON.stringify({ error: 'campaign_id and edit_action are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const manualBody: Record<string, unknown> = {
          reference_id: params.reference_id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          campaign_id: params.campaign_id,
          edit_action: params.edit_action,
        };

        if (params.budget !== undefined) manualBody.budget = params.budget;
        if (params.start_date) manualBody.start_date = params.start_date;
        if (params.end_date !== undefined) manualBody.end_date = params.end_date;
        if (params.roas_target !== undefined) manualBody.roas_target = params.roas_target;
        if (params.enhanced_cpc !== undefined) manualBody.enhanced_cpc = params.enhanced_cpc;

        result = await callShopeeAPI(
          partner_id,
          partner_key,
          access_token,
          shop_id,
          '/api/v2/ads/edit_manual_product_ads',
          'POST',
          undefined,
          manualBody
        );
        break;
      }

      case 'edit-auto-product-ads': {
        if (!params.campaign_id || !params.edit_action) {
          return new Response(
            JSON.stringify({ error: 'campaign_id and edit_action are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const autoBody: Record<string, unknown> = {
          reference_id: params.reference_id || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          campaign_id: params.campaign_id,
          edit_action: params.edit_action,
        };

        if (params.budget !== undefined) autoBody.budget = params.budget;
        if (params.start_date) autoBody.start_date = params.start_date;
        if (params.end_date !== undefined) autoBody.end_date = params.end_date;

        result = await callShopeeAPI(
          partner_id,
          partner_key,
          access_token,
          shop_id,
          '/api/v2/ads/edit_auto_product_ads',
          'POST',
          undefined,
          autoBody
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}. Valid: get-campaign-id-list, get-campaign-setting-info, edit-manual-product-ads, edit-auto-product-ads` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ ...result, _metadata: { action, shop_id, timestamp: new Date().toISOString() } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[shopee-ads] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
