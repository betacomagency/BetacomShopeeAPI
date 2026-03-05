/**
 * useApiRegistry - Hook lấy danh sách API endpoints đã sử dụng với stats tổng hợp
 * Gọi RPC get_api_registry_stats (GROUP BY endpoint)
 * Hỗ trợ cả preset (7d/30d...) và custom date range
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ApiRegistryEntry {
  api_endpoint: string;
  http_method: string;
  api_category: string;
  edge_function: string;
  total_calls: number;
  success_count: number;
  failed_count: number;
  timeout_count: number;
  success_rate: number;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  last_called_at: string;
}

export type SortField = 'total_calls' | 'success_rate' | 'avg_duration' | 'last_called_at' | 'api_endpoint';

export interface ApiRegistryFilters {
  category?: string;
  /** Custom date range - takes priority over dateRange preset */
  from?: Date;
  to?: Date;
}

export function useApiRegistry(filters: ApiRegistryFilters) {
  // Build RPC params
  const hasCustomRange = !!filters.from;
  const fromISO = filters.from?.toISOString() || null;
  const toISO = filters.to ? new Date(filters.to.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : null; // end of day

  return useQuery({
    queryKey: ['api-registry', fromISO, toISO, filters.category],
    queryFn: async (): Promise<ApiRegistryEntry[]> => {
      const params: Record<string, unknown> = {
        p_category: filters.category && filters.category !== 'all' ? filters.category : null,
      };

      if (hasCustomRange) {
        params.p_from = fromISO;
        params.p_to = toISO;
      } else {
        params.p_days = 7; // default
      }

      const { data, error } = await supabase.rpc('get_api_registry_stats', params);
      if (error) throw error;
      return (data || []).map((row: Record<string, unknown>) => ({
        api_endpoint: row.api_endpoint as string,
        http_method: row.http_method as string,
        api_category: row.api_category as string,
        edge_function: row.edge_function as string,
        total_calls: Number(row.total_calls),
        success_count: Number(row.success_count),
        failed_count: Number(row.failed_count),
        timeout_count: Number(row.timeout_count),
        success_rate: Number(row.success_rate),
        avg_duration: Number(row.avg_duration),
        min_duration: Number(row.min_duration),
        max_duration: Number(row.max_duration),
        last_called_at: row.last_called_at as string,
      }));
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
