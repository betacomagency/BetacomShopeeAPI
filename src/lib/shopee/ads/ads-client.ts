/**
 * Shopee Ads API Client
 * Gọi Shopee Ads API thông qua Edge Function
 */

import { supabase } from '../../supabase';

// ==================== TYPES ====================

export type AdType = 'auto' | 'manual' | 'all' | '';
export type CampaignStatus = 'ongoing' | 'scheduled' | 'ended' | 'paused' | 'deleted' | 'closed';
export type EditAction = 'start' | 'pause' | 'resume' | 'stop' | 'delete' | 'change_budget' | 'change_duration';

export interface CampaignIdItem {
  ad_type: AdType;
  campaign_id: number;
}

export interface CommonInfo {
  ad_type: AdType;
  ad_name: string;
  campaign_status: CampaignStatus;
  bidding_method: 'auto' | 'manual';
  campaign_placement: 'search' | 'discovery' | 'all';
  campaign_budget: number;
  campaign_duration: {
    start_time: number;
    end_time: number;
  };
  item_id_list: number[];
}

export interface AutoBiddingInfo {
  roas_target: number;
}

export interface CampaignSettingInfo {
  campaign_id: number;
  common_info?: CommonInfo;
  auto_bidding_info?: AutoBiddingInfo;
}

export interface CampaignInfo {
  campaign_id: number;
  ad_type: AdType;
  name: string | null;
  status: CampaignStatus | null;
  campaign_placement: string | null;
  bidding_method: string | null;
  campaign_budget: number;
  start_time: number | null;
  end_time: number | null;
  item_count: number;
  roas_target: number | null;
}

// ==================== API FUNCTIONS ====================

/**
 * Lấy danh sách campaign IDs
 */
export async function getCampaignIdList(params: {
  shop_id: number;
  ad_type?: AdType;
  offset?: number;
  limit?: number;
}) {
  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: 'get-campaign-id-list',
      shop_id: params.shop_id,
      ad_type: params.ad_type || 'all',
      offset: params.offset ?? 0,
      limit: params.limit ?? 5000,
    },
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Lấy thông tin chi tiết campaign
 */
export async function getCampaignSettingInfo(params: {
  shop_id: number;
  campaign_id_list: number[] | string;
  info_type_list?: string;
}) {
  const campaignIdList = Array.isArray(params.campaign_id_list)
    ? params.campaign_id_list.join(',')
    : params.campaign_id_list;

  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: 'get-campaign-setting-info',
      shop_id: params.shop_id,
      campaign_id_list: campaignIdList,
      info_type_list: params.info_type_list || '1,3',
    },
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Lấy tất cả campaigns với thông tin đầy đủ
 */
export async function getAllCampaignsWithInfo(
  shopId: number,
  adType: AdType = 'all'
): Promise<{ campaigns: CampaignInfo[]; error: string | null }> {
  try {
    // Step 1: Lấy danh sách campaign IDs
    const idListResponse = await getCampaignIdList({ shop_id: shopId, ad_type: adType });

    if (idListResponse.error || !idListResponse.response?.campaign_list?.length) {
      return { campaigns: [], error: idListResponse.error || idListResponse.message || null };
    }

    const campaignList = idListResponse.response.campaign_list as CampaignIdItem[];

    // Step 2: Lấy thông tin chi tiết (max 100 campaigns per request)
    const batchSize = 100;
    const allCampaigns: CampaignSettingInfo[] = [];

    for (let i = 0; i < campaignList.length; i += batchSize) {
      const batch = campaignList.slice(i, i + batchSize);
      const campaignIds = batch.map(c => c.campaign_id);

      const settingResponse = await getCampaignSettingInfo({
        shop_id: shopId,
        campaign_id_list: campaignIds,
        info_type_list: '1,3',
      });

      if (settingResponse.response?.campaign_list) {
        allCampaigns.push(...settingResponse.response.campaign_list);
      }
    }

    // Transform to CampaignInfo
    const campaigns: CampaignInfo[] = allCampaigns.map(c => {
      const original = campaignList.find(o => o.campaign_id === c.campaign_id);
      return {
        campaign_id: c.campaign_id,
        ad_type: (original?.ad_type || c.common_info?.ad_type || 'auto') as AdType,
        name: c.common_info?.ad_name || null,
        status: c.common_info?.campaign_status || null,
        campaign_placement: c.common_info?.campaign_placement || null,
        bidding_method: c.common_info?.bidding_method || null,
        campaign_budget: c.common_info?.campaign_budget || 0,
        start_time: c.common_info?.campaign_duration?.start_time || null,
        end_time: c.common_info?.campaign_duration?.end_time || null,
        item_count: c.common_info?.item_id_list?.length || 0,
        roas_target: c.auto_bidding_info?.roas_target || null,
      };
    });

    return { campaigns, error: null };
  } catch (err) {
    return { campaigns: [], error: (err as Error).message };
  }
}

// ==================== EDIT FUNCTIONS ====================

function generateReferenceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Chỉnh sửa ngân sách chiến dịch
 */
export async function editCampaignBudget(params: {
  shop_id: number;
  campaign_id: number;
  ad_type: 'auto' | 'manual';
  budget: number;
}) {
  const action = params.ad_type === 'manual' ? 'edit-manual-product-ads' : 'edit-auto-product-ads';

  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action,
      shop_id: params.shop_id,
      reference_id: generateReferenceId(),
      campaign_id: params.campaign_id,
      edit_action: 'change_budget',
      budget: params.budget,
    },
  });

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Thay đổi trạng thái chiến dịch
 */
export async function editCampaignStatus(params: {
  shop_id: number;
  campaign_id: number;
  ad_type: 'auto' | 'manual';
  action: 'start' | 'pause' | 'resume' | 'stop' | 'delete';
}) {
  const apiAction = params.ad_type === 'manual' ? 'edit-manual-product-ads' : 'edit-auto-product-ads';

  const { data, error } = await supabase.functions.invoke('shopee-ads', {
    body: {
      action: apiAction,
      shop_id: params.shop_id,
      reference_id: generateReferenceId(),
      campaign_id: params.campaign_id,
      edit_action: params.action,
    },
  });

  if (error) throw new Error(error.message);
  return data;
}
