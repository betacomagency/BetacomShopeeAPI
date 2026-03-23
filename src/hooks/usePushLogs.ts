/**
 * Hook for Push Logs - fetching paginated logs from apishopee_push_logs table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PushLog {
  id: string;
  push_code: number;
  push_type: string;
  shop_id: number | null;
  merchant_id: number | null;
  partner_id: number | null;
  data: Record<string, unknown> | null;
  processed: boolean;
  process_result: string | null;
  shopee_timestamp: number | null;
  created_at: string;
}

export interface PushLogFilters {
  pushCode?: number;
  processed?: string; // 'all' | 'true' | 'false'
  search?: string;
  dateRange?: '1h' | '24h' | '7d' | '30d' | 'all';
  page: number;
  pageSize: number;
}

export function getDateFilter(range?: string): string | null {
  if (!range || range === 'all') return null;
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

export function usePushLogs(filters: PushLogFilters) {
  return useQuery({
    queryKey: ['push-logs', filters],
    queryFn: async (): Promise<{ logs: PushLog[]; totalCount: number }> => {
      const { pushCode, processed, search, dateRange, page, pageSize } = filters;
      const dateFilter = getDateFilter(dateRange);

      // Count query
      let countQuery = supabase
        .from('apishopee_push_logs')
        .select('id', { count: 'exact', head: true });

      // Data query
      let dataQuery = supabase
        .from('apishopee_push_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      if (pushCode) {
        countQuery = countQuery.eq('push_code', pushCode);
        dataQuery = dataQuery.eq('push_code', pushCode);
      }
      if (processed && processed !== 'all') {
        const val = processed === 'true';
        countQuery = countQuery.eq('processed', val);
        dataQuery = dataQuery.eq('processed', val);
      }
      if (dateFilter) {
        countQuery = countQuery.gte('created_at', dateFilter);
        dataQuery = dataQuery.gte('created_at', dateFilter);
      }
      if (search) {
        const searchFilter = `push_type.ilike.%${search}%,process_result.ilike.%${search}%`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      return {
        logs: (dataResult.data || []) as PushLog[],
        totalCount: countResult.count || 0,
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}
