/**
 * useAdsCampaigns - Hook để lấy danh sách campaigns từ Shopee API
 *
 * Fetch trực tiếp từ Shopee API thông qua edge function,
 * không lưu cache vào database.
 */

import { useQuery } from '@tanstack/react-query';
import { getAllCampaignsWithInfo, type CampaignInfo, type AdType } from '@/lib/shopee/ads';

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
}

export function useAdsCampaigns(
  shopId: number | null,
  options: UseAdsCampaignsOptions = {}
): UseAdsCampaignsReturn {
  const { adType = 'all', statusFilter = 'all', enabled = true } = options;

  const query = useQuery({
    queryKey: ['ads-campaigns', shopId, adType],
    queryFn: async () => {
      if (!shopId) return { campaigns: [], error: null };
      console.log('[useAdsCampaigns] Fetching campaigns for shop:', shopId);
      const result = await getAllCampaignsWithInfo(shopId, adType);
      console.log('[useAdsCampaigns] Result:', {
        totalCampaigns: result.campaigns.length,
        error: result.error,
        statuses: result.campaigns.map(c => c.status),
      });
      return result;
    },
    enabled: enabled && !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const allCampaigns = query.data?.campaigns || [];

  // Filter by status if needed
  const filteredCampaigns = allCampaigns.filter(c => {
    if (statusFilter === 'ongoing') {
      return c.status === 'ongoing';
    }
    return true;
  });

  return {
    campaigns: filteredCampaigns,
    allCampaigns,
    loading: query.isLoading,
    error: query.data?.error || (query.error as Error)?.message || null,
    refetch: async () => { await query.refetch(); },
    isFetching: query.isFetching,
  };
}

export type { CampaignInfo };
