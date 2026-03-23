/**
 * Hook for daily API call statistics - calls RPC get_api_call_daily_stats
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface DailyStat {
  day: string;
  success_count: number;
  failed_count: number;
  timeout_count: number;
  avg_duration: number;
}

export interface ApiCallSummary {
  total: number;
  failed: number;
  successRate: number;
  avgDuration: number;
}

/** Map dateRange filter to days for RPC */
export function dateRangeToDays(range?: string): number {
  switch (range) {
    case '1h':
    case '24h':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    case 'all':
      return 365;
    default:
      return 7;
  }
}

export function useApiCallStats(filters: { shopId?: number; partnerId?: number; dateRange?: string }) {
  const days = dateRangeToDays(filters.dateRange);

  return useQuery({
    queryKey: ['api-call-stats', filters.shopId, filters.partnerId, days],
    queryFn: async (): Promise<{ dailyStats: DailyStat[]; summary: ApiCallSummary }> => {
      const { data, error } = await supabase.rpc('get_api_call_daily_stats', {
        p_shop_id: filters.shopId ?? null,
        p_days: days,
        p_partner_id: filters.partnerId ?? null,
      });

      if (error) throw error;

      const dailyStats: DailyStat[] = (data || []).map((row: DailyStat) => ({
        ...row,
        success_count: Number(row.success_count),
        failed_count: Number(row.failed_count),
        timeout_count: Number(row.timeout_count),
        avg_duration: Number(row.avg_duration) || 0,
      }));

      // Compute summary from daily data
      const total = dailyStats.reduce((s, d) => s + d.success_count + d.failed_count + d.timeout_count, 0);
      const failed = dailyStats.reduce((s, d) => s + d.failed_count + d.timeout_count, 0);
      const successRate = total > 0 ? ((total - failed) / total) * 100 : 0;
      const avgDuration =
        dailyStats.length > 0
          ? Math.round(dailyStats.reduce((s, d) => s + d.avg_duration, 0) / dailyStats.length)
          : 0;

      return { dailyStats, summary: { total, failed, successRate, avgDuration } };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
