-- Monitoring RPC functions for dashboard
-- 5 functions: system health, API analytics, business metrics, user activity, request trace

-- RPC 1: get_system_health()
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'worker', (
      SELECT json_build_object(
        'status', COALESCE(h.status, 'unknown'),
        'last_heartbeat', h.created_at,
        'metadata', h.metadata,
        'is_stale', CASE
          WHEN h.created_at < NOW() - INTERVAL '10 minutes' THEN true
          WHEN h.created_at IS NULL THEN true
          ELSE false END
      ) FROM health_check_logs h WHERE h.component = 'worker' ORDER BY h.created_at DESC LIMIT 1
    ),
    'edge_functions', (
      SELECT COALESCE(json_agg(fn_status), '[]'::json) FROM (
        SELECT json_build_object(
          'function', edge_function, 'last_call', MAX(created_at),
          'last_24h_calls', COUNT(*), 'last_24h_errors', COUNT(*) FILTER (WHERE status = 'failed'),
          'avg_duration_ms', ROUND(AVG(duration_ms))
        ) as fn_status FROM api_call_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY edge_function
      ) sub
    ),
    'tokens', (
      SELECT json_build_object(
        'total', COUNT(*),
        'healthy', COUNT(*) FILTER (WHERE expired_at > (EXTRACT(EPOCH FROM NOW()) * 1000 + 86400000)),
        'expiring_soon', COUNT(*) FILTER (WHERE expired_at BETWEEN (EXTRACT(EPOCH FROM NOW()) * 1000) AND (EXTRACT(EPOCH FROM NOW()) * 1000 + 86400000)),
        'expired', COUNT(*) FILTER (WHERE expired_at <= (EXTRACT(EPOCH FROM NOW()) * 1000))
      ) FROM apishopee_shops WHERE access_token IS NOT NULL
    )
  ) INTO result;
  RETURN result;
END; $$;

-- RPC 2: get_api_analytics(p_hours, p_edge_function, p_shop_id)
CREATE OR REPLACE FUNCTION get_api_analytics(p_hours INTEGER DEFAULT 24, p_edge_function TEXT DEFAULT NULL, p_shop_id BIGINT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON; start_time TIMESTAMPTZ := NOW() - (p_hours || ' hours')::INTERVAL;
BEGIN
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_calls', COUNT(*), 'success', COUNT(*) FILTER (WHERE status = 'success'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'), 'timeout', COUNT(*) FILTER (WHERE status = 'timeout'),
        'error_rate', ROUND(COUNT(*) FILTER (WHERE status != 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2),
        'avg_duration_ms', ROUND(AVG(duration_ms)),
        'p95_duration_ms', ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY COALESCE(duration_ms, 0)))
      ) FROM api_call_logs WHERE created_at > start_time
        AND (p_edge_function IS NULL OR edge_function = p_edge_function)
        AND (p_shop_id IS NULL OR shop_id = p_shop_id)
    ),
    'calls_per_hour', (
      SELECT COALESCE(json_agg(hourly ORDER BY hour), '[]'::json) FROM (
        SELECT json_build_object('hour', date_trunc('hour', created_at), 'total', COUNT(*),
          'success', COUNT(*) FILTER (WHERE status = 'success'),
          'failed', COUNT(*) FILTER (WHERE status != 'success')
        ) as hourly, date_trunc('hour', created_at) as hour
        FROM api_call_logs WHERE created_at > start_time
          AND (p_edge_function IS NULL OR edge_function = p_edge_function)
          AND (p_shop_id IS NULL OR shop_id = p_shop_id)
        GROUP BY date_trunc('hour', created_at)
      ) sub
    ),
    'top_errors', (
      SELECT COALESCE(json_agg(err), '[]'::json) FROM (
        SELECT json_build_object('error', shopee_error, 'message', shopee_message, 'count', COUNT(*), 'edge_function', edge_function) as err
        FROM api_call_logs WHERE created_at > start_time AND status = 'failed' AND shopee_error IS NOT NULL
          AND (p_edge_function IS NULL OR edge_function = p_edge_function)
          AND (p_shop_id IS NULL OR shop_id = p_shop_id)
        GROUP BY shopee_error, shopee_message, edge_function ORDER BY COUNT(*) DESC LIMIT 10
      ) sub
    ),
    'by_function', (
      SELECT COALESCE(json_agg(fn_stats), '[]'::json) FROM (
        SELECT json_build_object('edge_function', edge_function, 'total', COUNT(*),
          'error_rate', ROUND(COUNT(*) FILTER (WHERE status != 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2),
          'avg_duration_ms', ROUND(AVG(duration_ms))
        ) as fn_stats FROM api_call_logs WHERE created_at > start_time
          AND (p_shop_id IS NULL OR shop_id = p_shop_id) GROUP BY edge_function
      ) sub
    )
  ) INTO result;
  RETURN result;
END; $$;

-- RPC 3: get_business_metrics()
CREATE OR REPLACE FUNCTION get_business_metrics()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON; now_ms BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
BEGIN
  SELECT json_build_object(
    'shops', (
      SELECT json_build_object('total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE expired_at > now_ms),
        'inactive', COUNT(*) FILTER (WHERE expired_at <= now_ms OR expired_at IS NULL)
      ) FROM apishopee_shops WHERE access_token IS NOT NULL
    ),
    'flash_sales', (
      SELECT json_build_object(
        'today', json_build_object('total', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE),
          'success', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE AND status = 'success'),
          'failed', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE AND status IN ('error', 'failed')),
          'pending', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE AND status IN ('scheduled', 'processing', 'retry'))),
        'week', json_build_object('total', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days'),
          'success', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days' AND status = 'success'),
          'failed', COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days' AND status IN ('error', 'failed'))),
        'success_rate', ROUND(
          COUNT(*) FILTER (WHERE status = 'success' AND created_at > CURRENT_DATE - INTERVAL '7 days')::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('success', 'error', 'failed') AND created_at > CURRENT_DATE - INTERVAL '7 days'), 0) * 100, 2)
      ) FROM apishopee_flash_sale_auto_history
    ),
    'token_refresh', (
      SELECT json_build_object('last_24h', json_build_object(
        'success', COUNT(*) FILTER (WHERE status = 'success'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed')
      )) FROM system_activity_logs WHERE action_category = 'auth' AND action_type LIKE '%token%' AND created_at > NOW() - INTERVAL '24 hours'
    ),
    'jobs_queue', (
      SELECT json_build_object('scheduled', COUNT(*) FILTER (WHERE status = 'scheduled'),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'), 'retry', COUNT(*) FILTER (WHERE status = 'retry'),
        'success_today', COUNT(*) FILTER (WHERE status = 'success' AND created_at > CURRENT_DATE),
        'failed_today', COUNT(*) FILTER (WHERE status IN ('error', 'failed') AND created_at > CURRENT_DATE)
      ) FROM apishopee_flash_sale_auto_history
    )
  ) INTO result;
  RETURN result;
END; $$;

-- RPC 4: get_user_activity(p_hours, p_user_id)
CREATE OR REPLACE FUNCTION get_user_activity(p_hours INTEGER DEFAULT 24, p_user_id UUID DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON; start_time TIMESTAMPTZ := NOW() - (p_hours || ' hours')::INTERVAL;
BEGIN
  SELECT json_build_object(
    'timeline', (
      SELECT COALESCE(json_agg(activity), '[]'::json) FROM (
        SELECT json_build_object('id', id, 'user_name', user_name, 'user_email', user_email,
          'shop_name', shop_name, 'action_type', action_type, 'action_category', action_category,
          'action_description', action_description, 'status', status, 'source', source,
          'duration_ms', duration_ms, 'error_message', error_message, 'created_at', created_at
        ) as activity FROM system_activity_logs
        WHERE created_at > start_time AND (p_user_id IS NULL OR user_id = p_user_id)
        ORDER BY created_at DESC LIMIT 100
      ) sub
    ),
    'by_user', (
      SELECT COALESCE(json_agg(user_stats), '[]'::json) FROM (
        SELECT json_build_object('user_id', user_id, 'user_name', COALESCE(MAX(user_name), MAX(user_email)),
          'total_actions', COUNT(*), 'errors', COUNT(*) FILTER (WHERE status = 'failed'), 'last_action', MAX(created_at)
        ) as user_stats FROM system_activity_logs
        WHERE created_at > start_time AND user_id IS NOT NULL GROUP BY user_id
      ) sub
    ),
    'by_category', (
      SELECT COALESCE(json_agg(cat_stats), '[]'::json) FROM (
        SELECT json_build_object('category', action_category, 'total', COUNT(*),
          'success', COUNT(*) FILTER (WHERE status = 'success'), 'failed', COUNT(*) FILTER (WHERE status = 'failed')
        ) as cat_stats FROM system_activity_logs WHERE created_at > start_time GROUP BY action_category
      ) sub
    )
  ) INTO result;
  RETURN result;
END; $$;

-- RPC 5: trace_request(p_request_id)
CREATE OR REPLACE FUNCTION trace_request(p_request_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'api_calls', (
      SELECT COALESCE(json_agg(d), '[]'::json) FROM (
        SELECT json_build_object('id', id, 'edge_function', edge_function, 'api_endpoint', api_endpoint,
          'http_method', http_method, 'status', status, 'duration_ms', duration_ms,
          'http_status_code', http_status_code, 'shopee_error', shopee_error, 'shopee_message', shopee_message,
          'shop_id', shop_id, 'user_email', user_email, 'triggered_by', triggered_by,
          'request_params', request_params, 'response_summary', response_summary, 'created_at', created_at
        ) as d FROM api_call_logs WHERE request_id = p_request_id ORDER BY created_at ASC
      ) sub
    ),
    'activities', (
      SELECT COALESCE(json_agg(d), '[]'::json) FROM (
        SELECT json_build_object('id', id, 'action_type', action_type, 'action_description', action_description,
          'status', status, 'duration_ms', duration_ms, 'user_name', user_name, 'shop_name', shop_name, 'created_at', created_at
        ) as d FROM system_activity_logs WHERE request_id = p_request_id ORDER BY created_at ASC
      ) sub
    )
  ) INTO result;
  RETURN result;
END; $$;

-- Grants
GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_analytics(INTEGER, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION trace_request(UUID) TO authenticated;
