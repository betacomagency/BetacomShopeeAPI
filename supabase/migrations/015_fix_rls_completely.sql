-- Migration: Fix RLS hoàn toàn cho shops và user_shops
-- Vấn đề: Circular dependency - không thể INSERT vào shops nếu chưa có user_shops

-- ============================================
-- 1. DROP TẤT CẢ POLICIES CŨ
-- ============================================

-- Shops policies
DROP POLICY IF EXISTS "Users can view their shops" ON shops;
DROP POLICY IF EXISTS "Users can insert their shops" ON shops;
DROP POLICY IF EXISTS "Users can update their shops" ON shops;
DROP POLICY IF EXISTS "Users can delete their shops" ON shops;
DROP POLICY IF EXISTS "Admins can view all shops" ON shops;
DROP POLICY IF EXISTS "Authenticated users can insert shops" ON shops;
DROP POLICY IF EXISTS "Service role full access to shops" ON shops;

-- User_shops policies
DROP POLICY IF EXISTS "Users can view own shops" ON user_shops;
DROP POLICY IF EXISTS "Users can insert own shops" ON user_shops;
DROP POLICY IF EXISTS "Users can update own shops" ON user_shops;
DROP POLICY IF EXISTS "Users can delete own shops" ON user_shops;
DROP POLICY IF EXISTS "Admins can view all user shops" ON user_shops;
DROP POLICY IF EXISTS "Service role full access to user_shops" ON user_shops;

-- ============================================
-- 2. TẠO POLICIES MỚI CHO SHOPS
-- ============================================

-- SELECT: User có thể xem shops mà họ liên kết qua user_shops
CREATE POLICY "shops_select_own" ON shops
  FOR SELECT
  USING (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

-- INSERT: Bất kỳ authenticated user nào cũng có thể tạo shop mới
-- (Sau đó họ cần tạo liên kết trong user_shops)
CREATE POLICY "shops_insert_authenticated" ON shops
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: User có thể update shops mà họ liên kết
CREATE POLICY "shops_update_own" ON shops
  FOR UPDATE
  USING (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

-- DELETE: User có thể delete shops mà họ liên kết
CREATE POLICY "shops_delete_own" ON shops
  FOR DELETE
  USING (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

-- ============================================
-- 3. TẠO POLICIES MỚI CHO USER_SHOPS
-- ============================================

-- SELECT: User chỉ xem được liên kết của mình
CREATE POLICY "user_shops_select_own" ON user_shops
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: User chỉ tạo được liên kết cho chính mình
CREATE POLICY "user_shops_insert_own" ON user_shops
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: User chỉ update được liên kết của mình
CREATE POLICY "user_shops_update_own" ON user_shops
  FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: User chỉ delete được liên kết của mình
CREATE POLICY "user_shops_delete_own" ON user_shops
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 4. ĐẢM BẢO RLS ENABLED
-- ============================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_shops ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_shops TO authenticated;

-- ============================================
-- 6. VERIFY
-- ============================================

-- Kiểm tra policies đã tạo
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('shops', 'user_shops');
