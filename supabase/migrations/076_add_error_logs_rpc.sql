-- Paginated error/API logs with filters for monitoring detail view
CREATE OR REPLACE FUNCTION get_error_logs(
  p_date DATE DEFAULT CURRENT_DATE,
  p_edge_function TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50,
  p_shop_id BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_offset INTEGER := (p_page - 1) * p_page_size;
  start_ts TIMESTAMPTZ := p_date::TIMESTAMPTZ;
  end_ts TIMESTAMPTZ := (p_date + 1)::TIMESTAMPTZ;
BEGIN
  SELECT json_build_object(
    'total', (
      SELECT COUNT(*)
      FROM api_call_logs
      WHERE created_at >= start_ts AND created_at < end_ts
        AND (p_status IS NULL AND status != 'success' OR p_status IS NOT NULL AND status = p_status)
        AND (p_edge_function IS NULL OR edge_function = p_edge_function)
        AND (p_shop_id IS NULL OR shop_id = p_shop_id)
        AND (p_search IS NULL OR shopee_error ILIKE '%' || p_search || '%' OR shopee_message ILIKE '%' || p_search || '%' OR api_endpoint ILIKE '%' || p_search || '%')
    ),
    'page', p_page,
    'page_size', p_page_size,
    'items', (
      SELECT COALESCE(json_agg(row_data), '[]'::json)
      FROM (
        SELECT json_build_object(
          'id', id, 'edge_function', edge_function, 'api_endpoint', api_endpoint,
          'http_method', http_method, 'status', status, 'shopee_error', shopee_error,
          'shopee_message', shopee_message, 'http_status_code', http_status_code,
          'duration_ms', duration_ms, 'shop_id', shop_id, 'partner_id', partner_id,
          'user_email', user_email, 'triggered_by', triggered_by,
          'request_params', request_params, 'response_summary', response_summary,
          'request_id', request_id, 'created_at', created_at
        ) as row_data
        FROM api_call_logs
        WHERE created_at >= start_ts AND created_at < end_ts
          AND (p_status IS NULL AND status != 'success' OR p_status IS NOT NULL AND status = p_status)
          AND (p_edge_function IS NULL OR edge_function = p_edge_function)
          AND (p_shop_id IS NULL OR shop_id = p_shop_id)
          AND (p_search IS NULL OR shopee_error ILIKE '%' || p_search || '%' OR shopee_message ILIKE '%' || p_search || '%' OR api_endpoint ILIKE '%' || p_search || '%')
        ORDER BY created_at DESC
        LIMIT p_page_size OFFSET v_offset
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_error_logs(DATE, TEXT, INTEGER, INTEGER, BIGINT, TEXT, TEXT) TO authenticated;
