-- =====================================================
-- Migration 068: Create Partner Apps & Shop App Tokens
-- =====================================================
-- Enables multi-partner app support (ERP + Ads) for same merchant.
-- Backend edge functions already reference these tables.
-- This migration creates the missing tables to complete multi-app architecture.

-- =====================================================
-- 1. apishopee_partner_apps - Partner App Registry
-- =====================================================
CREATE TABLE IF NOT EXISTS apishopee_partner_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id BIGINT NOT NULL UNIQUE,
  partner_key TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  app_category TEXT NOT NULL CHECK (app_category IN ('erp', 'ads')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE apishopee_partner_apps IS 'Registry of Shopee partner apps (ERP, Ads) with credentials';
COMMENT ON COLUMN apishopee_partner_apps.partner_id IS 'Shopee Partner ID (unique per app)';
COMMENT ON COLUMN apishopee_partner_apps.partner_key IS 'Shopee Partner Key (secret, service role only)';
COMMENT ON COLUMN apishopee_partner_apps.app_category IS 'App type: erp (products/orders) or ads (campaigns)';

-- =====================================================
-- 2. apishopee_shop_app_tokens - Per-App Tokens Per Shop
-- =====================================================
CREATE TABLE IF NOT EXISTS apishopee_shop_app_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  partner_app_id UUID NOT NULL REFERENCES apishopee_partner_apps(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expire_in INTEGER,
  expired_at BIGINT,
  access_token_expired_at BIGINT,
  expire_time BIGINT,
  auth_time BIGINT,
  merchant_id BIGINT,
  token_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, partner_app_id)
);

COMMENT ON TABLE apishopee_shop_app_tokens IS 'Per-app OAuth tokens for each shop. Each (shop, partner_app) pair has independent tokens.';
COMMENT ON COLUMN apishopee_shop_app_tokens.shop_id IS 'Shopee numeric shop ID';
COMMENT ON COLUMN apishopee_shop_app_tokens.partner_app_id IS 'FK to apishopee_partner_apps.id';
COMMENT ON COLUMN apishopee_shop_app_tokens.expired_at IS 'Access token expiry timestamp (ms)';
COMMENT ON COLUMN apishopee_shop_app_tokens.expire_time IS 'Authorization expiry timestamp (1 year from auth)';

-- Indexes for common queries
CREATE INDEX idx_shop_app_tokens_shop_id ON apishopee_shop_app_tokens(shop_id);
CREATE INDEX idx_shop_app_tokens_partner_app_id ON apishopee_shop_app_tokens(partner_app_id);
CREATE INDEX idx_shop_app_tokens_expired_at ON apishopee_shop_app_tokens(expired_at);
CREATE INDEX idx_shop_app_tokens_merchant_id ON apishopee_shop_app_tokens(merchant_id) WHERE merchant_id IS NOT NULL;

-- =====================================================
-- 3. RLS Policies
-- =====================================================

-- Partner Apps: read-only for authenticated users, full access for service role
ALTER TABLE apishopee_partner_apps ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active partner apps (but NOT partner_key via column security)
CREATE POLICY "Authenticated users can view partner apps"
  ON apishopee_partner_apps
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role has full access (edge functions)
CREATE POLICY "Service role full access to partner apps"
  ON apishopee_partner_apps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Shop App Tokens: users can only view tokens for shops they're members of
ALTER TABLE apishopee_shop_app_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view app tokens of their shops"
  ON apishopee_shop_app_tokens
  FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT s.shop_id FROM apishopee_shops s
      JOIN apishopee_shop_members sm ON sm.shop_id = s.id
      WHERE sm.profile_id = auth.uid() AND sm.is_active = true
    )
  );

-- Service role has full access (edge functions for token save/refresh)
CREATE POLICY "Service role full access to shop app tokens"
  ON apishopee_shop_app_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. Migrate existing tokens from apishopee_shops
-- =====================================================
-- Only migrate if partner_id exists in apishopee_partner_apps
-- This runs AFTER seed data is inserted (see step 5 below or manual insert)
-- NOTE: This migration does NOT seed partner apps with keys.
-- Partner keys must be inserted manually via SQL or Supabase dashboard:
--
--   INSERT INTO apishopee_partner_apps (partner_id, partner_key, partner_name, app_category)
--   VALUES
--     (2015129, 'YOUR_ERP_PARTNER_KEY', 'Betacom', 'erp'),
--     (2030005, 'YOUR_ADS_PARTNER_KEY', 'Betacom Ads', 'ads');
--
-- After seeding, migrate existing tokens:
--
--   INSERT INTO apishopee_shop_app_tokens (shop_id, partner_app_id, access_token, refresh_token, expire_in, expired_at, access_token_expired_at, expire_time, auth_time, merchant_id, token_updated_at)
--   SELECT s.shop_id, pa.id, s.access_token, s.refresh_token, s.expire_in,
--          COALESCE(s.expired_at, s.access_token_expired_at),
--          s.access_token_expired_at, s.expire_time, s.auth_time, s.merchant_id, s.token_updated_at
--   FROM apishopee_shops s
--   JOIN apishopee_partner_apps pa ON pa.partner_id = s.partner_id
--   WHERE s.access_token IS NOT NULL AND s.partner_id IS NOT NULL
--   ON CONFLICT (shop_id, partner_app_id) DO NOTHING;
