-- =============================================
-- Migration: Add minute columns to ads schedule
-- Description: Thêm cột minute_start và minute_end để hỗ trợ lịch chính xác đến phút
-- =============================================

-- Thêm cột minute_start và minute_end
ALTER TABLE apishopee_scheduled_ads_budget 
ADD COLUMN IF NOT EXISTS minute_start INT DEFAULT 0 CHECK (minute_start >= 0 AND minute_start <= 59);

ALTER TABLE apishopee_scheduled_ads_budget 
ADD COLUMN IF NOT EXISTS minute_end INT DEFAULT 0 CHECK (minute_end >= 0 AND minute_end <= 59);

-- Drop old constraint
ALTER TABLE apishopee_scheduled_ads_budget 
DROP CONSTRAINT IF EXISTS apishopee_scheduled_ads_budget_shop_id_campaign_id_hour_star_key;

-- Add new constraint với minute_start
ALTER TABLE apishopee_scheduled_ads_budget 
ADD CONSTRAINT apishopee_scheduled_ads_budget_unique_schedule 
UNIQUE(shop_id, campaign_id, hour_start, minute_start);

-- Update index
DROP INDEX IF EXISTS idx_scheduled_ads_budget_active;
CREATE INDEX IF NOT EXISTS idx_scheduled_ads_budget_active 
ON apishopee_scheduled_ads_budget(is_active, hour_start, minute_start);

-- Comment
COMMENT ON COLUMN apishopee_scheduled_ads_budget.minute_start IS 'Phút bắt đầu (0-59), dùng cho lịch chính xác đến phút';
COMMENT ON COLUMN apishopee_scheduled_ads_budget.minute_end IS 'Phút kết thúc (0-59)';
