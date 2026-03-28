import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface UserActivity {
  timeline: Array<{
    id: string;
    user_name: string | null;
    user_email: string | null;
    shop_name: string | null;
    action_type: string;
    action_category: string;
    action_description: string;
    status: string;
    source: string;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
  }>;
  by_user: Array<{
    user_id: string;
    user_name: string;
    total_actions: number;
    errors: number;
    last_action: string;
  }>;
  by_category: Array<{
    category: string;
    total: number;
    success: number;
    failed: number;
  }>;
}

export function useUserActivity(hours = 24, userId?: string) {
  return useQuery<UserActivity>({
    queryKey: ['user-activity', hours, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_activity', {
        p_hours: hours,
        p_user_id: userId ?? null,
      });
      if (error) throw error;
      return data as UserActivity;
    },
    refetchInterval: 60_000,
  });
}
