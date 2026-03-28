-- Health check logs table for monitoring system
-- Stores periodic heartbeats from Worker and Edge Function pings

CREATE TABLE IF NOT EXISTS health_check_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  component TEXT NOT NULL,              -- 'worker', 'edge_function:apishopee-proxy', etc.
  status TEXT NOT NULL DEFAULT 'healthy', -- 'healthy', 'degraded', 'down'
  response_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',          -- {uptime, memory, cron_status, error_message}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for dashboard queries: latest health per component
CREATE INDEX idx_health_check_component_created
  ON health_check_logs (component, created_at DESC);

-- Index for retention cleanup
CREATE INDEX idx_health_check_created
  ON health_check_logs (created_at);

-- RLS
ALTER TABLE health_check_logs ENABLE ROW LEVEL SECURITY;

-- Service role (worker + edge functions) can insert
CREATE POLICY "service_role_all" ON health_check_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read (monitoring dashboard)
CREATE POLICY "authenticated_read" ON health_check_logs
  FOR SELECT TO authenticated USING (true);
