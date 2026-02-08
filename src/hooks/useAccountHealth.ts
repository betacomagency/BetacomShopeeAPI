/**
 * Hook: useAccountHealth
 * Lấy tất cả dữ liệu hiệu quả hoạt động shop từ Shopee AccountHealth API
 * 7 API calls: shopPenalty, shopPerformance, penaltyPointHistory,
 *              punishmentOngoing, punishmentCompleted, listingsIssues, lateOrders
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ==================== TYPES ====================

// --- Shop Penalty (tổng hợp điểm phạt) ---
export interface PenaltyPoints {
  overall_penalty_points: number;
  non_fulfillment_rate: number;
  late_shipment_rate: number;
  listing_violations: number;
  opfr_violations: number;
  others: number;
}

export interface OngoingPunishment {
  punishment_tier: number;
  days_left: number;
  punishment_name: string;
}

// --- Shop Performance (chỉ số hiệu suất) ---
export interface OverallPerformance {
  rating: number; // 1=Poor, 2=ImprovementNeeded, 3=Good, 4=Excellent
  fulfillment_failed: number;
  listing_failed: number;
  custom_service_failed: number;
}

export interface MetricTarget {
  value: number;
  comparator: string; // <, <=, >, >=, =
}

export interface PerformanceMetric {
  metric_type: number; // 1=Fulfillment, 2=Listing, 3=CustomerService
  metric_id: number;
  parent_metric_id: number;
  metric_name: string;
  current_period: number | null;
  last_period: number | null;
  unit: number; // 1=Number, 2=Percentage, 3=Second, 4=Day, 5=Hour
  target: MetricTarget;
}

// --- Penalty Point History ---
export interface PenaltyPointRecord {
  issue_time: number;
  latest_point_num: number;
  original_point_num: number;
  reference_id: number;
  violation_type: number;
}

// --- Punishment History ---
export interface Punishment {
  issue_time: number;
  reference_id: number;
  reason: number;
  punishment_type: number;
  start_time: number;
  end_time: number;
  listing_limit?: number;
  order_limit?: string;
}

// --- Listings Issues ---
export interface ListingIssue {
  item_id: number;
  reason: number;
}

// --- Late Orders ---
export interface LateOrder {
  order_sn: string;
  shipping_deadline: number;
  late_by_days: number;
}

// --- API Result wrapper ---
interface ApiResult<T> {
  error: string | null;
  message: string | null;
  response: T | null;
}

// --- Aggregated response ---
export interface AccountHealthData {
  shopPenalty: ApiResult<{
    penalty_points: PenaltyPoints;
    ongoing_punishment: OngoingPunishment[];
  }>;
  shopPerformance: ApiResult<{
    overall_performance: OverallPerformance;
    metric_list: PerformanceMetric[];
  }>;
  penaltyPointHistory: ApiResult<{
    penalty_point_list: PenaltyPointRecord[];
    total_count: number;
  }>;
  punishmentOngoing: ApiResult<{
    punishment_list: Punishment[];
    total_count: number;
  }>;
  punishmentCompleted: ApiResult<{
    punishment_list: Punishment[];
    total_count: number;
  }>;
  listingsIssues: ApiResult<{
    listing_list: ListingIssue[];
    total_count: number;
  }>;
  lateOrders: ApiResult<{
    late_order_list: LateOrder[];
    total_count: number;
  }>;
  _meta?: {
    total_apis: number;
    success: number;
    failed: number;
    timestamp: string;
  };
}

// --- Cached DB record ---
export interface CachedAccountHealth {
  id: number;
  shop_id: number;
  shop_penalty: AccountHealthData['shopPenalty'] | null;
  shop_performance: AccountHealthData['shopPerformance'] | null;
  penalty_point_history: AccountHealthData['penaltyPointHistory'] | null;
  punishment_ongoing: AccountHealthData['punishmentOngoing'] | null;
  punishment_completed: AccountHealthData['punishmentCompleted'] | null;
  listings_issues: AccountHealthData['listingsIssues'] | null;
  late_orders: AccountHealthData['lateOrders'] | null;
  api_success_count: number;
  api_failed_count: number;
  fetch_source: string;
  fetched_at: string;
}

function dbRecordToAccountHealth(record: CachedAccountHealth): AccountHealthData {
  const emptyResult = { error: null, message: null, response: null };
  return {
    shopPenalty: record.shop_penalty || emptyResult,
    shopPerformance: record.shop_performance || emptyResult,
    penaltyPointHistory: record.penalty_point_history || emptyResult,
    punishmentOngoing: record.punishment_ongoing || emptyResult,
    punishmentCompleted: record.punishment_completed || emptyResult,
    listingsIssues: record.listings_issues || emptyResult,
    lateOrders: record.late_orders || emptyResult,
    _meta: {
      total_apis: 7,
      success: record.api_success_count,
      failed: record.api_failed_count,
      timestamp: record.fetched_at,
    },
  };
}

async function fetchCachedAccountHealth(shopId: number): Promise<AccountHealthData | null> {
  const { data, error } = await supabase
    .from('apishopee_account_health')
    .select('*')
    .eq('shop_id', shopId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return dbRecordToAccountHealth(data as CachedAccountHealth);
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

/**
 * Hook chính: load cached data tự động, fetch live khi user bấm nút
 */
export function useAccountHealth(shopId: number | null) {
  // Query cached data từ DB (tự động load khi có shopId)
  const cachedQuery = useQuery({
    queryKey: ['account-health-cached', shopId],
    queryFn: () => fetchCachedAccountHealth(shopId!),
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Query live data từ Shopee API (chỉ fetch khi user bấm nút)
  const liveQuery = useQuery({
    queryKey: ['account-health', shopId],
    queryFn: () => fetchAccountHealth(shopId!),
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Ưu tiên live data, fallback sang cached
  const data = liveQuery.data || cachedQuery.data || undefined;
  const isLoading = liveQuery.isLoading || (cachedQuery.isLoading && !liveQuery.data);
  const isFetching = liveQuery.isFetching;

  return {
    ...liveQuery,
    data,
    isLoading,
    isFetching,
    cachedAt: cachedQuery.data?._meta?.timestamp || null,
    hasCachedData: !!cachedQuery.data,
  };
}
