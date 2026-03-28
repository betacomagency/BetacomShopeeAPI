-- Rate limit analysis: API calls/minute per partner with rate limit error overlay
CREATE OR REPLACE FUNCTION get_rate_limit_analysis(
  p_hours INTEGER DEFAULT 6,
  p_partner_id BIGINT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  start_time TIMESTAMPTZ := NOW() - (p_hours || ' hours')::INTERVAL;
BEGIN
  SELECT json_build_object(
    'timeline', (
      SELECT COALESCE(json_agg(row_data ORDER BY minute), '[]'::json)
      FROM (
        SELECT json_build_object(
          'minute', date_trunc('minute', created_at),
          'total_calls', COUNT(*),
          'success', COUNT(*) FILTER (WHERE status = 'success'),
          'rate_limit_errors', COUNT(*) FILTER (WHERE shopee_error = 'error_rate_limit'),
          'other_errors', COUNT(*) FILTER (WHERE status != 'success' AND (shopee_error IS NULL OR shopee_error != 'error_rate_limit')),
          'partner_id', partner_id
        ) as row_data,
        date_trunc('minute', created_at) as minute
        FROM api_call_logs
        WHERE created_at > start_time
          AND (p_partner_id IS NULL OR partner_id = p_partner_id)
        GROUP BY date_trunc('minute', created_at), partner_id
      ) sub
    ),
    'summary', (
      SELECT json_build_object(
        'total_calls', COUNT(*),
        'rate_limit_errors', COUNT(*) FILTER (WHERE shopee_error = 'error_rate_limit'),
        'peak_calls_per_min', (
          SELECT MAX(cnt) FROM (
            SELECT COUNT(*) as cnt FROM api_call_logs
            WHERE created_at > start_time AND (p_partner_id IS NULL OR partner_id = p_partner_id)
            GROUP BY date_trunc('minute', created_at)
          ) sub
        ),
        'safe_threshold_per_min', (
          SELECT COALESCE(MIN(cnt), 0) FROM (
            SELECT date_trunc('minute', created_at) as min, COUNT(*) as cnt
            FROM api_call_logs
            WHERE created_at > start_time AND (p_partner_id IS NULL OR partner_id = p_partner_id)
              AND shopee_error = 'error_rate_limit'
            GROUP BY date_trunc('minute', created_at)
          ) sub
        ),
        'avg_calls_per_min', ROUND(
          COUNT(*)::NUMERIC / NULLIF(EXTRACT(EPOCH FROM (NOW() - start_time)) / 60, 0), 1
        )
      )
      FROM api_call_logs
      WHERE created_at > start_time AND (p_partner_id IS NULL OR partner_id = p_partner_id)
    ),
    'partners', (
      SELECT COALESCE(json_agg(p), '[]'::json)
      FROM (
        SELECT json_build_object(
          'partner_id', partner_id, 'total_calls', COUNT(*),
          'rate_limit_errors', COUNT(*) FILTER (WHERE shopee_error = 'error_rate_limit')
        ) as p
        FROM api_call_logs
        WHERE created_at > start_time AND partner_id IS NOT NULL
        GROUP BY partner_id
      ) sub
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_rate_limit_analysis(INTEGER, BIGINT) TO authenticated;
