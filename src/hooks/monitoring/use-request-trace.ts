import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface RequestTrace {
  api_calls: Array<{
    id: string;
    edge_function: string;
    api_endpoint: string;
    http_method: string;
    status: string;
    duration_ms: number | null;
    http_status_code: number | null;
    shopee_error: string | null;
    shopee_message: string | null;
    shop_id: number | null;
    user_email: string | null;
    triggered_by: string;
    request_params: Record<string, unknown> | null;
    response_summary: Record<string, unknown> | null;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    action_type: string;
    action_description: string;
    status: string;
    duration_ms: number | null;
    user_name: string | null;
    shop_name: string | null;
    created_at: string;
  }>;
}

export function useRequestTrace(requestId: string | null) {
  return useQuery<RequestTrace>({
    queryKey: ['request-trace', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('No request ID');
      const { data, error } = await supabase.rpc('trace_request', {
        p_request_id: requestId,
      });
      if (error) throw error;
      return data as RequestTrace;
    },
    enabled: !!requestId,
  });
}
