-- Add request_id column to api_call_logs for request tracing
-- Nullable: backward-compatible, only populated when frontend sends x-request-id

ALTER TABLE api_call_logs ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE INDEX idx_api_call_logs_request_id
  ON api_call_logs (request_id) WHERE request_id IS NOT NULL;

-- Also add request_id to system_activity_logs for full chain tracing
ALTER TABLE system_activity_logs ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE INDEX idx_activity_logs_request_id
  ON system_activity_logs (request_id) WHERE request_id IS NOT NULL;
