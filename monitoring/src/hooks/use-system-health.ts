import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface SystemHealth {
  worker: {
    status: string;
    last_heartbeat: string | null;
    metadata: Record<string, unknown> | null;
    is_stale: boolean;
  } | null;
  edge_functions: Array<{
    function: string;
    last_call: string;
    last_24h_calls: number;
    last_24h_errors: number;
    avg_duration_ms: number;
  }>;
  tokens: {
    total: number;
    healthy: number;
    expiring_soon: number;
    expired: number;
  };
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_health');
      if (error) throw error;
      return data as SystemHealth;
    },
    refetchInterval: 30_000,
  });
}
