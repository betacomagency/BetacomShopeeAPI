-- Migration: Create Flash Sale Auto History table with retry mechanism
-- Date: 2026-03-17
-- Purpose: Track scheduled flash sale jobs with retry support

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS apishopee_flash_sale_auto_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id bigint NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  timeslot_id bigint NOT NULL,
  slot_start_time bigint,
  slot_end_time bigint,
  items_count integer DEFAULT 0,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'success', 'error', 'partial', 'retry', 'pending')),
  flash_sale_id bigint,
  error_message text,
  items_data jsonb,
  retry_count integer DEFAULT 0,
  executed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add retry_count column if table already exists but column doesn't
ALTER TABLE apishopee_flash_sale_auto_history
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- Add items_data column if missing
ALTER TABLE apishopee_flash_sale_auto_history
ADD COLUMN IF NOT EXISTS items_data jsonb;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_flash_sale_auto_history_shop_id
ON apishopee_flash_sale_auto_history(shop_id);

CREATE INDEX IF NOT EXISTS idx_flash_sale_auto_history_status_scheduled
ON apishopee_flash_sale_auto_history(status, scheduled_at)
WHERE status IN ('scheduled', 'retry');

CREATE INDEX IF NOT EXISTS idx_flash_sale_auto_history_user_id
ON apishopee_flash_sale_auto_history(user_id);

-- RLS Policies
ALTER TABLE apishopee_flash_sale_auto_history ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own history
DROP POLICY IF EXISTS "Users can view own flash sale history" ON apishopee_flash_sale_auto_history;
CREATE POLICY "Users can view own flash sale history"
ON apishopee_flash_sale_auto_history FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own records
DROP POLICY IF EXISTS "Users can insert own flash sale history" ON apishopee_flash_sale_auto_history;
CREATE POLICY "Users can insert own flash sale history"
ON apishopee_flash_sale_auto_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own records
DROP POLICY IF EXISTS "Users can update own flash sale history" ON apishopee_flash_sale_auto_history;
CREATE POLICY "Users can update own flash sale history"
ON apishopee_flash_sale_auto_history FOR UPDATE
USING (auth.uid() = user_id);

-- Allow service role full access (for scheduler)
DROP POLICY IF EXISTS "Service role has full access to flash sale history" ON apishopee_flash_sale_auto_history;
CREATE POLICY "Service role has full access to flash sale history"
ON apishopee_flash_sale_auto_history FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Comments
COMMENT ON TABLE apishopee_flash_sale_auto_history IS 'Tracks scheduled and executed flash sale auto-setup jobs';
COMMENT ON COLUMN apishopee_flash_sale_auto_history.retry_count IS 'Number of retry attempts. Max 3 retries before permanent failure.';
COMMENT ON COLUMN apishopee_flash_sale_auto_history.status IS 'Job status: scheduled, processing, success, error, partial, retry';
