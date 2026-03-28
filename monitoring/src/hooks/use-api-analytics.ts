import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ApiAnalytics {
  summary: {
    total_calls: number;
    success: number;
    failed: number;
    timeout: number;
    error_rate: number;
    avg_duration_ms: number;
    p95_duration_ms: number;
  };
  calls_per_hour: Array<{
    hour: string;
    total: number;
    success: number;
    failed: number;
  }>;
  top_errors: Array<{
    error: string;
    message: string;
    count: number;
    edge_function: string;
  }>;
  by_function: Array<{
    edge_function: string;
    total: number;
    error_rate: number;
    avg_duration_ms: number;
  }>;
}

export function useApiAnalytics(hours = 24, edgeFunction?: string, shopId?: number) {
  return useQuery<ApiAnalytics>({
    queryKey: ['api-analytics', hours, edgeFunction, shopId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_api_analytics', {
        p_hours: hours,
        p_edge_function: edgeFunction ?? null,
        p_shop_id: shopId ?? null,
      });
      if (error) throw error;
      return data as ApiAnalytics;
    },
    refetchInterval: 60_000,
  });
}
