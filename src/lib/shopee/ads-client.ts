/**
 * Shopee Ads API Client
 * Calls Shopee Ads endpoints via proxy edge function.
 * Proxy auto-detects app_category='ads' from API path.
 */

import { supabase } from '@/lib/supabase';

interface ProxyCallParams {
  api_path: string;
  shop_id: number;
  method?: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

async function callAdsProxy({ api_path, shop_id, method = 'GET', params = {}, body }: ProxyCallParams) {
  const { data, error } = await supabase.functions.invoke('apishopee-proxy', {
    body: { api_path, shop_id, method, params, body },
  });

  if (error) throw new Error(error.message || 'Proxy call failed');

  const responseData = data?.response?.data;
  if (responseData?.error) {
    throw new Error(responseData.message || `Shopee error: ${responseData.error}`);
  }
  if (responseData === undefined || responseData === null) {
    throw new Error(`No response data from ${api_path}`);
  }

  return responseData;
}

// Campaign list
export async function getAdsCampaigns(shopId: number) {
  return callAdsProxy({
    api_path: '/api/v2/ads/get_all_campaign_brief_list',
    shop_id: shopId,
  });
}

// Campaign detail
export async function getAdsCampaignDetail(shopId: number, campaignId: number) {
  return callAdsProxy({
    api_path: '/api/v2/ads/get_campaign_detail',
    shop_id: shopId,
    params: { campaign_id: campaignId },
  });
}

// Update campaign status (enable/disable)
export async function updateAdsCampaignStatus(shopId: number, campaignId: number, status: 'ongoing' | 'paused' | 'ended') {
  return callAdsProxy({
    api_path: '/api/v2/ads/update_campaign_status',
    shop_id: shopId,
    method: 'POST',
    body: { campaign_id: campaignId, status },
  });
}

// Campaign daily performance
export async function getAdsCampaignPerformance(
  shopId: number,
  startDate: number, // Unix timestamp (seconds)
  endDate: number,
) {
  return callAdsProxy({
    api_path: '/api/v2/ads/get_campaign_daily_performance',
    shop_id: shopId,
    params: { start_date: startDate, end_date: endDate },
  });
}
