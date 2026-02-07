/**
 * useAdsCampaigns - Hook để lấy danh sách campaigns từ Shopee API
 *
 * Fetch trực tiếp từ Shopee API thông qua edge function,
 * không lưu cache vào database.
 */

// [HIDDEN] Ads feature - imports disabled
// import { useQuery } from '@tanstack/react-query';
// import { getAllCampaignsWithInfo } from '@/lib/shopee/ads';
import type { CampaignInfo, AdType } from '@/lib/shopee/ads';

export interface UseAdsCampaignsOptions {
  adType?: AdType;
  statusFilter?: 'ongoing' | 'all';
  enabled?: boolean;
}

export interface UseAdsCampaignsReturn {
  campaigns: CampaignInfo[];
  allCampaigns: CampaignInfo[]; // Tất cả campaigns (không filter status)
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isFetching: boolean;
  hasFetched: boolean;
}

// [HIDDEN] Ads feature - temporarily disabled. No API calls will be made.
export function useAdsCampaigns(
  _shopId: number | null,
  _options: UseAdsCampaignsOptions = {}
): UseAdsCampaignsReturn {
  return {
    campaigns: [],
    allCampaigns: [],
    loading: false,
    error: null,
    refetch: async () => {},
    isFetching: false,
    hasFetched: false,
  };
}

export type { CampaignInfo };
