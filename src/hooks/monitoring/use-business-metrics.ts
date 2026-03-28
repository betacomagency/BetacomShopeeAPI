import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface BusinessMetrics {
  shops: { total: number; active: number; inactive: number };
  flash_sales: {
    today: { total: number; success: number; failed: number; pending: number };
    week: { total: number; success: number; failed: number };
    success_rate: number | null;
  };
  token_refresh: { last_24h: { success: number; failed: number } };
  jobs_queue: {
    scheduled: number;
    processing: number;
    retry: number;
    success_today: number;
    failed_today: number;
  };
}

export function useBusinessMetrics() {
  return useQuery<BusinessMetrics>({
    queryKey: ['business-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_business_metrics');
      if (error) throw error;
      return data as BusinessMetrics;
    },
    refetchInterval: 60_000,
  });
}
