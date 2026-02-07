/**
 * Hooks for API Logs - fetching stats and paginated logs from api_call_logs table
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Types
export interface ApiCallLog {
  id: string;
  shop_id: number | null;
  edge_function: string;
  api_endpoint: string;
  http_method: string;
  api_category: string;
  status: string;
  shopee_error: string | null;
  shopee_message: string | null;
  http_status_code: number | null;
  duration_ms: number | null;
  request_timestamp: string;
  request_params: Record<string, unknown> | null;
  response_summary: Record<string, unknown> | null;
  retry_count: number;
  was_token_refreshed: boolean;
  created_at: string;
}

export interface ApiLogStats {
  totalCalls: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgDuration: number;
  topFailingEndpoints: Array<{
    api_endpoint: string;
    fail_count: number;
    total_count: number;
    fail_rate: number;
  }>;
  callsByCategory: Array<{
    api_category: string;
    count: number;
    success_count: number;
    failed_count: number;
  }>;
  callsOverTime: Array<{
    date: string;
    success: number;
    failed: number;
    total: number;
  }>;
}

export interface ApiLogFilters {
  shopId?: number;
  apiCategory?: string;
  status?: string;
  search?: string;
  dateRange?: '1h' | '24h' | '7d' | '30d' | 'all';
  page: number;
  pageSize: number;
}

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

/**
 * Fetch aggregated stats for the dashboard
 */
export function useApiLogStats(shopId?: number, days = 7) {
  return useQuery({
    queryKey: ['api-log-stats', shopId, days],
    queryFn: async (): Promise<ApiLogStats> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all logs in the date range
      let query = supabase
        .from('api_call_logs')
        .select('api_endpoint, api_category, status, duration_ms, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      const allLogs = logs || [];
      const totalCalls = allLogs.length;
      const successCount = allLogs.filter(l => l.status === 'success').length;
      const failedCount = allLogs.filter(l => l.status === 'failed').length;
      const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;
      const avgDuration = totalCalls > 0
        ? allLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / totalCalls
        : 0;

      // Top failing endpoints
      const endpointMap = new Map<string, { fail: number; total: number }>();
      allLogs.forEach(l => {
        const key = l.api_endpoint;
        const existing = endpointMap.get(key) || { fail: 0, total: 0 };
        existing.total++;
        if (l.status === 'failed') existing.fail++;
        endpointMap.set(key, existing);
      });

      const topFailingEndpoints = Array.from(endpointMap.entries())
        .filter(([, v]) => v.fail > 0)
        .map(([endpoint, v]) => ({
          api_endpoint: endpoint,
          fail_count: v.fail,
          total_count: v.total,
          fail_rate: (v.fail / v.total) * 100,
        }))
        .sort((a, b) => b.fail_count - a.fail_count)
        .slice(0, 10);

      // Calls by category
      const categoryMap = new Map<string, { count: number; success: number; failed: number }>();
      allLogs.forEach(l => {
        const key = l.api_category;
        const existing = categoryMap.get(key) || { count: 0, success: 0, failed: 0 };
        existing.count++;
        if (l.status === 'success') existing.success++;
        if (l.status === 'failed') existing.failed++;
        categoryMap.set(key, existing);
      });

      const callsByCategory = Array.from(categoryMap.entries()).map(([cat, v]) => ({
        api_category: cat,
        count: v.count,
        success_count: v.success,
        failed_count: v.failed,
      }));

      // Calls over time (group by date)
      const dateMap = new Map<string, { success: number; failed: number; total: number }>();
      allLogs.forEach(l => {
        const date = l.created_at.split('T')[0];
        const existing = dateMap.get(date) || { success: 0, failed: 0, total: 0 };
        existing.total++;
        if (l.status === 'success') existing.success++;
        if (l.status === 'failed') existing.failed++;
        dateMap.set(date, existing);
      });

      const callsOverTime = Array.from(dateMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalCalls,
        successCount,
        failedCount,
        successRate,
        avgDuration,
        topFailingEndpoints,
        callsByCategory,
        callsOverTime,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch paginated logs with filters
 */
export function useApiLogs(filters: ApiLogFilters) {
  return useQuery({
    queryKey: ['api-logs', filters],
    queryFn: async (): Promise<{ logs: ApiCallLog[]; totalCount: number }> => {
      const { shopId, apiCategory, status, search, dateRange, page, pageSize } = filters;
      const dateFilter = getDateFilter(dateRange);

      // Count query
      let countQuery = supabase
        .from('api_call_logs')
        .select('id', { count: 'exact', head: true });

      // Data query
      let dataQuery = supabase
        .from('api_call_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters to both queries
      if (shopId) {
        countQuery = countQuery.eq('shop_id', shopId);
        dataQuery = dataQuery.eq('shop_id', shopId);
      }
      if (apiCategory && apiCategory !== 'all') {
        countQuery = countQuery.eq('api_category', apiCategory);
        dataQuery = dataQuery.eq('api_category', apiCategory);
      }
      if (status && status !== 'all') {
        countQuery = countQuery.eq('status', status);
        dataQuery = dataQuery.eq('status', status);
      }
      if (dateFilter) {
        countQuery = countQuery.gte('created_at', dateFilter);
        dataQuery = dataQuery.gte('created_at', dateFilter);
      }
      if (search) {
        const searchFilter = `api_endpoint.ilike.%${search}%,shopee_error.ilike.%${search}%,shopee_message.ilike.%${search}%,edge_function.ilike.%${search}%`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
      }

      const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      return {
        logs: (dataResult.data || []) as ApiCallLog[],
        totalCount: countResult.count || 0,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch endpoint health for API Registry (24h success rate per endpoint)
 */
export function useEndpointHealth() {
  return useQuery({
    queryKey: ['endpoint-health'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('api_call_logs')
        .select('api_endpoint, status')
        .gte('created_at', since);

      if (error) throw error;

      const endpointMap = new Map<string, { success: number; total: number }>();
      (data || []).forEach((log: { api_endpoint: string; status: string }) => {
        const existing = endpointMap.get(log.api_endpoint) || { success: 0, total: 0 };
        existing.total++;
        if (log.status === 'success') existing.success++;
        endpointMap.set(log.api_endpoint, existing);
      });

      const result: Record<string, { successRate: number; totalCalls: number }> = {};
      endpointMap.forEach((v, k) => {
        result[k] = {
          successRate: v.total > 0 ? (v.success / v.total) * 100 : 0,
          totalCalls: v.total,
        };
      });

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
