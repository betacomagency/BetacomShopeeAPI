import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ErrorLogItem {
  id: string;
  edge_function: string;
  api_endpoint: string;
  http_method: string;
  status: string;
  shopee_error: string | null;
  shopee_message: string | null;
  http_status_code: number | null;
  duration_ms: number | null;
  shop_id: number | null;
  partner_id: number | null;
  user_email: string | null;
  triggered_by: string;
  request_params: Record<string, unknown> | null;
  response_summary: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
}

export interface ErrorLogsResult {
  total: number;
  page: number;
  page_size: number;
  items: ErrorLogItem[];
}

export interface ErrorLogsFilters {
  date: string;
  edgeFunction?: string;
  page?: number;
  pageSize?: number;
  shopId?: number;
  status?: string;
  search?: string;
}

export function useErrorLogs(filters: ErrorLogsFilters) {
  const { date, edgeFunction, page = 1, pageSize = 50, shopId, status, search } = filters;
  return useQuery<ErrorLogsResult>({
    queryKey: ['error-logs', date, edgeFunction, page, pageSize, shopId, status, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_error_logs', {
        p_date: date,
        p_edge_function: edgeFunction ?? null,
        p_page: page,
        p_page_size: pageSize,
        p_shop_id: shopId ?? null,
        p_status: status ?? null,
        p_search: search ?? null,
      });
      if (error) throw error;
      return data as ErrorLogsResult;
    },
    refetchInterval: 60_000,
  });
}
