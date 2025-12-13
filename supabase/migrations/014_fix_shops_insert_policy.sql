-- Migration: Fix circular dependency trong RLS policies
-- Vấn đề: Không thể INSERT vào shops vì policy yêu cầu shop_id phải có trong user_shops
-- Nhưng user_shops cần shop_id tồn tại trước

-- ============================================
-- 1. FIX POLICY CHO SHOPS INSERT
-- ============================================

-- Drop policy cũ
DROP POLICY IF EXISTS "Users can insert their shops" ON shops;

-- Policy mới: Cho phép authenticated users INSERT vào shops
-- Sau đó họ phải tạo record trong user_shops để có thể SELECT/UPDATE/DELETE
CREATE POLICY "Authenticated users can insert shops" ON shops
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 2. FIX POLICY CHO USER_SHOPS INSERT  
-- ============================================

-- Drop policy cũ nếu có vấn đề
DROP POLICY IF EXISTS "Users can insert own shops" ON user_shops;

-- Policy mới: User có thể insert vào user_shops với user_id = auth.uid()
CREATE POLICY "Users can insert own shops" ON user_shops
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. THÊM SERVICE ROLE BYPASS (cho edge functions)
-- ============================================

-- Tạo policy cho service role có thể bypass RLS
-- Điều này cho phép edge functions hoạt động đúng

-- Shops: Service role có thể làm mọi thứ
CREATE POLICY "Service role full access to shops" ON shops
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- User_shops: Service role có thể làm mọi thứ  
CREATE POLICY "Service role full access to user_shops" ON user_shops
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 4. COMMENTS
-- ============================================

COMMENT ON POLICY "Authenticated users can insert shops" ON shops IS 
  'Cho phép authenticated users tạo shop mới, sau đó phải liên kết qua user_shops';

COMMENT ON POLICY "Service role full access to shops" ON shops IS 
  'Cho phép edge functions và service role bypass RLS';
