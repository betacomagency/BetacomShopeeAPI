-- =====================================================
-- Migration 069: Column-level security for partner apps
-- =====================================================
-- Prevents authenticated users from reading sensitive columns:
-- - apishopee_partner_apps.partner_key
-- - apishopee_shop_app_tokens.access_token, refresh_token

-- Hide partner_key from authenticated users
REVOKE ALL ON apishopee_partner_apps FROM authenticated;
GRANT SELECT (id, partner_id, partner_name, app_category, is_active, created_at) ON apishopee_partner_apps TO authenticated;

-- Hide access_token/refresh_token from authenticated users
REVOKE ALL ON apishopee_shop_app_tokens FROM authenticated;
GRANT SELECT (id, shop_id, partner_app_id, expire_in, expired_at, access_token_expired_at, expire_time, auth_time, merchant_id, token_updated_at, created_at) ON apishopee_shop_app_tokens TO authenticated;
