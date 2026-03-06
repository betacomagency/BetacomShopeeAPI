/**
 * Hook for API Call Logs - fetching paginated logs from api_call_logs table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ApiCallLog {
  id: string;
  shop_id: number | null;
  partner_id: number | null;
  edge_function: string;
  api_endpoint: string;
  http_method: string | null;
  api_category: string;
  status: string | null;
  shopee_error: string | null;
  shopee_message: string | null;
  http_status_code: number | null;
  duration_ms: number | null;
  request_timestamp: string | null;
  request_params: Record<string, unknown> | null;
  response_summary: Record<string, unknown> | null;
  retry_count: number | null;
  was_token_refreshed: boolean | null;
  user_id: string | null;
  user_email: string | null;
  triggered_by: string | null;
  created_at: string;
}

/** Lightweight version without heavy JSONB columns for list queries */
export type ApiCallLogListItem = Omit<ApiCallLog, 'request_params' | 'response_summary'>;

export interface ApiCallLogFilters {
  search?: string;
  shopId?: number;
  partnerId?: number;
  category?: string;
  status?: string;
  edgeFunction?: string;
  userEmail?: string;
  triggeredBy?: string;
  dateRange?: '1h' | '24h' | '7d' | '30d' | 'all';
  /** Custom date range - takes priority over dateRange preset */
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

const LIST_COLUMNS = 'id, shop_id, partner_id, edge_function, api_endpoint, http_method, api_category, status, shopee_error, shopee_message, http_status_code, duration_ms, retry_count, was_token_refreshed, user_id, user_email, triggered_by, created_at';

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

export function useApiCallLogs(filters: ApiCallLogFilters) {
  return useQuery({
    queryKey: ['api-call-logs', filters],
    queryFn: async (): Promise<{ logs: ApiCallLogListItem[]; totalCount: number }> => {
      const { shopId, partnerId, category, status, edgeFunction, userEmail, triggeredBy, search, dateRange, dateFrom, dateTo, page, pageSize } = filters;
      const dateFilter = dateFrom ? null : getDateFilter(dateRange);

      // Count query
      let countQuery = supabase
        .from('api_call_logs')
        .select('id', { count: 'exact', head: true });

      // Data query - lightweight columns only
      let dataQuery = supabase
        .from('api_call_logs')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters to both queries
      if (shopId) {
        countQuery = countQuery.eq('shop_id', shopId);
        dataQuery = dataQuery.eq('shop_id', shopId);
      }
      if (partnerId) {
        countQuery = countQuery.eq('partner_id', partnerId);
        dataQuery = dataQuery.eq('partner_id', partnerId);
      }
      if (category && category !== 'all') {
        countQuery = countQuery.eq('api_category', category);
        dataQuery = dataQuery.eq('api_category', category);
      }
      if (status && status !== 'all') {
        countQuery = countQuery.eq('status', status);
        dataQuery = dataQuery.eq('status', status);
      }
      if (edgeFunction && edgeFunction !== 'all') {
        countQuery = countQuery.eq('edge_function', edgeFunction);
        dataQuery = dataQuery.eq('edge_function', edgeFunction);
      }
      if (userEmail && userEmail !== 'all') {
        countQuery = countQuery.eq('user_email', userEmail);
        dataQuery = dataQuery.eq('user_email', userEmail);
      }
      if (triggeredBy && triggeredBy !== 'all') {
        countQuery = countQuery.eq('triggered_by', triggeredBy);
        dataQuery = dataQuery.eq('triggered_by', triggeredBy);
      }
      if (dateFrom) {
        const fromISO = dateFrom.toISOString();
        countQuery = countQuery.gte('created_at', fromISO);
        dataQuery = dataQuery.gte('created_at', fromISO);
        if (dateTo) {
          const toISO = new Date(dateTo.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
          countQuery = countQuery.lte('created_at', toISO);
          dataQuery = dataQuery.lte('created_at', toISO);
        }
      } else if (dateFilter) {
        countQuery = countQuery.gte('created_at', dateFilter);
        dataQuery = dataQuery.gte('created_at', dateFilter);
      }
      if (search) {
        const s = search.replace(/%/g, '');
        const searchFilter = `api_endpoint.ilike.%${s}%,shopee_error.ilike.%${s}%,shopee_message.ilike.%${s}%`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      return {
        logs: (dataResult.data || []) as ApiCallLogListItem[],
        totalCount: countResult.count || 0,
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Fetch a single log with full JSONB data for detail dialog */
export async function fetchApiCallLogDetail(logId: string): Promise<ApiCallLog | null> {
  const { data, error } = await supabase
    .from('api_call_logs')
    .select('*')
    .eq('id', logId)
    .single();

  if (error) {
    console.error('Error fetching log detail:', error);
    return null;
  }
  return data as ApiCallLog;
}
