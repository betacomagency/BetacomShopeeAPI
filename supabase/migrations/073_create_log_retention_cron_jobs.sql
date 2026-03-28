-- Log retention cron jobs
-- Clean up old logs weekly using batched DELETE to avoid table locks

-- Health check logs: keep 30 days (batched 10K rows at a time)
SELECT cron.schedule(
  'cleanup-health-check-logs',
  '0 3 * * 0',  -- Sunday 3am UTC
  $$DELETE FROM health_check_logs WHERE id IN (
    SELECT id FROM health_check_logs WHERE created_at < NOW() - INTERVAL '30 days' LIMIT 10000
  )$$
);

-- API call logs: keep 90 days (batched 10K rows at a time)
SELECT cron.schedule(
  'cleanup-api-call-logs',
  '0 4 * * 0',  -- Sunday 4am UTC
  $$DELETE FROM api_call_logs WHERE id IN (
    SELECT id FROM api_call_logs WHERE created_at < NOW() - INTERVAL '90 days' LIMIT 10000
  )$$
);

-- System activity logs: keep 180 days (batched 10K rows at a time)
SELECT cron.schedule(
  'cleanup-activity-logs',
  '0 5 * * 0',  -- Sunday 5am UTC
  $$DELETE FROM system_activity_logs WHERE id IN (
    SELECT id FROM system_activity_logs WHERE created_at < NOW() - INTERVAL '180 days' LIMIT 10000
  )$$
);
