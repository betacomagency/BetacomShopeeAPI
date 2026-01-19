-- Migration: Optimize reviews query performance
-- Issues:
-- 1. RLS policy uses complex subquery with JOIN for each row
-- 2. Missing indexes for common query patterns
-- 3. No index on apishopee_shop_members for RLS lookups

-- =====================================================
-- 1. Create helper view for user's accessible shop_ids (materialized for RLS)
-- =====================================================

-- Create a security definer function to get user's shop IDs
-- This is cached and more efficient than the subquery in RLS
CREATE OR REPLACE FUNCTION get_user_shop_ids()
RETURNS SETOF BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.shop_id
  FROM apishopee_shop_members sm
  JOIN apishopee_shops s ON s.id = sm.shop_id
  WHERE sm.profile_id = auth.uid()
  AND sm.is_active = true;
$$;

-- =====================================================
-- 2. Optimize RLS policies using the helper function
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view reviews of their shops" ON apishopee_reviews;
DROP POLICY IF EXISTS "Users can view sync status of their shops" ON apishopee_reviews_sync_status;

-- Create optimized policies using the security definer function
CREATE POLICY "Users can view reviews of their shops" ON apishopee_reviews
  FOR SELECT
  USING (shop_id IN (SELECT get_user_shop_ids()));

CREATE POLICY "Users can view sync status of their shops" ON apishopee_reviews_sync_status
  FOR SELECT
  USING (shop_id IN (SELECT get_user_shop_ids()));

-- =====================================================
-- 3. Add missing indexes for better query performance
-- =====================================================

-- Index on shop_members for RLS lookups (profile_id is used in RLS check)
CREATE INDEX IF NOT EXISTS idx_shop_members_profile_active 
ON apishopee_shop_members(profile_id, is_active) 
WHERE is_active = true;

-- Index on shops for shop_id lookup (used in RLS function)
CREATE INDEX IF NOT EXISTS idx_shops_shop_id ON apishopee_shops(shop_id);

-- Composite index for reviews query pattern (shop_id + create_time DESC)
-- This is the most common query pattern
DROP INDEX IF EXISTS idx_reviews_shop_create_time;
CREATE INDEX idx_reviews_shop_create_time ON apishopee_reviews(shop_id, create_time DESC);

-- Index for products lookup by shop_id + item_id
CREATE INDEX IF NOT EXISTS idx_products_shop_item 
ON apishopee_products(shop_id, item_id);

-- =====================================================
-- 4. Add comments
-- =====================================================
COMMENT ON FUNCTION get_user_shop_ids() IS 'Returns shop_ids that the current user has access to. Used by RLS policies for better performance.';
