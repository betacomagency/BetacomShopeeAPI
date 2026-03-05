/**
 * Hook for Activity Logs - fetching paginated logs from system_activity_logs table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  shop_id: number | null;
  shop_name: string | null;
  action_type: string;
  action_category: string;
  action_description: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  request_data: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  status: string;
  error_message: string | null;
  error_code: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  source: string | null;
  created_at: string;
}

export type ActivityLogListItem = Omit<ActivityLog, 'request_data' | 'response_data'>;

export interface ActivityLogFilters {
  category?: string;
  status?: string;
  source?: string;
  dateRange?: '1h' | '24h' | '7d' | '30d' | 'all';
  shopId?: number;
  page: number;
  pageSize: number;
}

const LIST_COLUMNS = 'id, user_id, user_email, user_name, shop_id, shop_name, action_type, action_category, action_description, target_type, target_id, target_name, status, error_message, error_code, started_at, completed_at, duration_ms, source, created_at';

function getDateFilter(range?: string): string | null {
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

export function useActivityLogs(filters: ActivityLogFilters) {
  return useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: async (): Promise<{ logs: ActivityLogListItem[]; totalCount: number }> => {
      const { category, status, source, dateRange, shopId, page, pageSize } = filters;
      const dateFilter = getDateFilter(dateRange);

      let countQuery = supabase
        .from('system_activity_logs')
        .select('id', { count: 'exact', head: true });

      let dataQuery = supabase
        .from('system_activity_logs')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (category && category !== 'all') {
        countQuery = countQuery.eq('action_category', category);
        dataQuery = dataQuery.eq('action_category', category);
      }
      if (status && status !== 'all') {
        countQuery = countQuery.eq('status', status);
        dataQuery = dataQuery.eq('status', status);
      }
      if (source && source !== 'all') {
        countQuery = countQuery.eq('source', source);
        dataQuery = dataQuery.eq('source', source);
      }
      if (shopId) {
        countQuery = countQuery.eq('shop_id', shopId);
        dataQuery = dataQuery.eq('shop_id', shopId);
      }
      if (dateFilter) {
        countQuery = countQuery.gte('created_at', dateFilter);
        dataQuery = dataQuery.gte('created_at', dateFilter);
      }

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      return {
        logs: (dataResult.data || []) as ActivityLogListItem[],
        totalCount: countResult.count || 0,
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export async function fetchActivityLogDetail(logId: string): Promise<ActivityLog | null> {
  const { data, error } = await supabase
    .from('system_activity_logs')
    .select('*')
    .eq('id', logId)
    .single();

  if (error) {
    console.error('Error fetching activity log detail:', error);
    return null;
  }
  return data as ActivityLog;
}
