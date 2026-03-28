-- Enable Supabase Realtime on health_check_logs for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE health_check_logs;
