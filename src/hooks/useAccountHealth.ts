/**
 * Hook: useAccountHealth
 * Lấy dữ liệu hiệu quả hoạt động shop từ Shopee AccountHealth API
 * 5 API calls: penaltyPoints, punishmentOngoing, punishmentCompleted, listingsIssues, lateOrders
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PenaltyPoint {
  penalty_points: number;
  penalty_point_change: number;
  reason: number;
  issue_time: number;
}

export interface Punishment {
  issue_time: number;
  reference_id: number;
  reason: number;
  punishment_type: number;
  start_time: number;
  end_time: number;
  listing_limit: number;
  order_limit: string;
}

export interface ListingIssue {
  item_id: number;
  issue_type: number;
  issue_detail: string;
  item_name?: string;
}

export interface LateOrder {
  order_sn: string;
  late_type: number;
  late_ship_time?: number;
}

interface ApiResult<T> {
  error: string | null;
  message: string | null;
  response: T | null;
}

export interface AccountHealthData {
  penaltyPoints: ApiResult<{
    total_count: number;
    penalty_point_list: PenaltyPoint[];
  }>;
  punishmentOngoing: ApiResult<{
    total_count: number;
    punishment_list: Punishment[];
  }>;
  punishmentCompleted: ApiResult<{
    total_count: number;
    punishment_list: Punishment[];
  }>;
  listingsIssues: ApiResult<{
    total_count: number;
    listing_list: ListingIssue[];
  }>;
  lateOrders: ApiResult<{
    total_count: number;
    late_order_list: LateOrder[];
  }>;
  _meta?: {
    total_apis: number;
    success: number;
    failed: number;
    timestamp: string;
  };
}

async function fetchAccountHealth(shopId: number): Promise<AccountHealthData> {
  const { data, error } = await supabase.functions.invoke('shopee-account-health', {
    body: { action: 'get-all', shop_id: shopId },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch account health data');
  }

  return data as AccountHealthData;
}

export function useAccountHealth(shopId: number | null) {
  return useQuery({
    queryKey: ['account-health', shopId],
    queryFn: () => fetchAccountHealth(shopId!),
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
