-- Migration: Create cron job for finance/escrow sync
-- Tự động sync thông tin tiền thực nhận (escrow) cho đơn hàng COMPLETED mỗi 30 phút

-- =====================================================
-- 1. Tạo function để sync escrow cho tất cả shops
-- =====================================================
CREATE OR REPLACE FUNCTION sync_all_shops_escrow()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  shop_record RECORD;
  shop_count INTEGER := 0;
  success_count INTEGER := 0;
  function_url TEXT := 'https://ohlwhhxhgpotlwfgqhhu.supabase.co/functions/v1/apishopee-finance-sync';
  service_role_key TEXT;
BEGIN
  -- Lấy service role key từ vault
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  -- Lấy tất cả shops có đơn hàng COMPLETED cần fetch escrow
  -- Điều kiện:
  -- 1. Shop có access_token hợp lệ
  -- 2. Shop có ít nhất 1 đơn hàng COMPLETED chưa fetch escrow
  FOR shop_record IN
    SELECT DISTINCT s.shop_id,
           COUNT(o.order_sn) as pending_count
    FROM apishopee_shops s
    INNER JOIN apishopee_orders o ON s.shop_id = o.shop_id
    WHERE s.access_token IS NOT NULL
      AND s.status = 'active'
      AND o.order_status = 'COMPLETED'
      AND (o.is_escrow_fetched = false OR o.is_escrow_fetched IS NULL)
    GROUP BY s.shop_id
    HAVING COUNT(o.order_sn) > 0
    ORDER BY COUNT(o.order_sn) DESC  -- Ưu tiên shop có nhiều đơn cần fetch
    LIMIT 10  -- Giới hạn 10 shops mỗi lần chạy cron
  LOOP
    shop_count := shop_count + 1;

    BEGIN
      -- Gọi Edge Function để sync escrow (fire-and-forget với pg_net)
      PERFORM net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
        ),
        body := jsonb_build_object(
          'action', 'sync',
          'shop_id', shop_record.shop_id
        ),
        timeout_milliseconds := 120000  -- 120s timeout cho HTTP request (escrow sync có thể lâu)
      );

      success_count := success_count + 1;
      RAISE NOTICE 'Triggered escrow sync for shop % (% pending orders) [%/%]',
                   shop_record.shop_id, shop_record.pending_count, success_count, shop_count;

      -- Stagger requests: đợi 10 giây giữa các shop để tránh rate limit
      -- (escrow API thường chậm hơn các API khác)
      PERFORM pg_sleep(10);

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to trigger escrow sync for shop %: %', shop_record.shop_id, SQLERRM;
      -- Continue với shop tiếp theo
    END;
  END LOOP;

  RAISE NOTICE 'Escrow sync cron completed: triggered %/% shops', success_count, shop_count;
END;
$$;

-- =====================================================
-- 2. Xóa cron job cũ nếu tồn tại
-- =====================================================
DO $$
BEGIN
  PERFORM cron.unschedule('escrow-sync-job');
EXCEPTION WHEN OTHERS THEN
  -- Job không tồn tại, bỏ qua
  NULL;
END $$;

-- =====================================================
-- 3. Tạo cron job sync escrow mỗi 30 phút
-- =====================================================
SELECT cron.schedule(
  'escrow-sync-job',
  '15,45 * * * *',  -- Mỗi 30 phút: phút 15 và 45 mỗi giờ (lệch orders sync để tránh xung đột)
  'SELECT sync_all_shops_escrow();'
);

-- =====================================================
-- 4. Comments
-- =====================================================
COMMENT ON FUNCTION sync_all_shops_escrow() IS
'Sync escrow (tiền thực nhận) từ Shopee API cho đơn hàng COMPLETED.
- Chạy mỗi 30 phút qua cron (phút 15, 45)
- Chỉ sync shop có đơn COMPLETED chưa fetch escrow
- Ưu tiên shop có nhiều đơn pending
- Stagger 10s giữa các shop để tránh rate limit
- Giới hạn 10 shops mỗi lần chạy';
