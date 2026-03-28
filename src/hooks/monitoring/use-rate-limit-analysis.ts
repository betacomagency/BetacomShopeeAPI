import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface RateLimitTimeline {
  minute: string;
  total_calls: number;
  success: number;
  rate_limit_errors: number;
  other_errors: number;
  partner_id: number;
}

export interface RateLimitAnalysis {
  timeline: RateLimitTimeline[];
  summary: {
    total_calls: number;
    rate_limit_errors: number;
    peak_calls_per_min: number;
    safe_threshold_per_min: number;
    avg_calls_per_min: number;
  };
  partners: Array<{
    partner_id: number;
    total_calls: number;
    rate_limit_errors: number;
  }>;
}

export function useRateLimitAnalysis(hours = 6, partnerId?: number) {
  return useQuery<RateLimitAnalysis>({
    queryKey: ['rate-limit-analysis', hours, partnerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rate_limit_analysis', {
        p_hours: hours,
        p_partner_id: partnerId ?? null,
      });
      if (error) throw error;
      return data as RateLimitAnalysis;
    },
    refetchInterval: 60_000,
  });
}
