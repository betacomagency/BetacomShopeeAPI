import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Subscribe to health_check_logs INSERT events.
 * On new heartbeat → invalidate system-health query for instant UI update.
 */
export function useRealtimeHealth() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('health-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'health_check_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['system-health'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
