/**
 * Shopee Ads API Client
 * Gọi shopee-ads edge function để quản lý quảng cáo
 */

import { supabase } from '../supabase';

// ==================== Types ====================

export interface AdsCampaign {
  campaign_id: number;
  campaign_type: string;
  title: string;
  status: string;
  daily_budget: number;
  start_time: number;
  end_time: number;
  state: string;
}

export interface AdsApiResponse<T = unknown> {
  request: {
    method: string;
    url: string;
    params: Record<string, unknown>;
    body: Record<string, unknown> | null;
  };
  response: {
    status: number;
    statusText: string;
    time_ms: number;
    data: T;
  };
}

// ==================== API Functions ====================

/**
 * Lấy danh sách tất cả ads campaigns
 */
export async function getAdsCampaigns(
  shopId: number,
  pageSize = 100,
  offset = 0
): Promise<AdsApiResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: 'get-campaigns',
      shop_id: shopId,
      params: { page_size: pageSize, offset },
    },
  });

  if (error) throw new Error(error.message || 'Failed to fetch ads campaigns');
  return data as AdsApiResponse;
}

/**
 * Lấy chi tiết campaign
 */
export async function getAdsCampaignDetail(
  shopId: number,
  campaignId: number
): Promise<AdsApiResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: 'get-campaign-detail',
      shop_id: shopId,
      params: { campaign_id: campaignId },
    },
  });

  if (error) throw new Error(error.message || 'Failed to fetch campaign detail');
  return data as AdsApiResponse;
}

/**
 * Cập nhật ngân sách chiến dịch
 */
export async function updateCampaignBudget(
  shopId: number,
  campaignId: number,
  dailyBudget: number
): Promise<AdsApiResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: 'update-budget',
      shop_id: shopId,
      body: {
        campaign_id: campaignId,
        daily_budget: dailyBudget,
      },
    },
  });

  if (error) throw new Error(error.message || 'Failed to update campaign budget');
  return data as AdsApiResponse;
}

/**
 * Bật/tắt chiến dịch
 */
export async function toggleCampaignStatus(
  shopId: number,
  campaignId: number,
  enable: boolean
): Promise<AdsApiResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: 'toggle-campaign',
      shop_id: shopId,
      body: {
        campaign_id: campaignId,
        action: enable ? 'activate' : 'pause',
      },
    },
  });

  if (error) throw new Error(error.message || 'Failed to toggle campaign status');
  return data as AdsApiResponse;
}

/**
 * Generic Ads API call (for custom endpoints)
 */
export async function callAdsApi(
  shopId: number,
  apiPath: string,
  method = 'POST',
  bodyData?: Record<string, unknown>,
  params?: Record<string, unknown>
): Promise<AdsApiResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      api_path: apiPath,
      method,
      shop_id: shopId,
      body: bodyData,
      params,
    },
  });

  if (error) throw new Error(error.message || 'Failed to call ads API');
  return data as AdsApiResponse;
}
