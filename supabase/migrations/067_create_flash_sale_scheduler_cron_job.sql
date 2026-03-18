-- Migration: Flash sale scheduler optimization + cron job
-- 1. Thêm column lead_time_minutes (thiếu trong schema gốc)
-- 2. Tự động trigger flash sale scheduler mỗi 2 phút

-- =====================================================
-- 0. Thêm column lead_time_minutes nếu chưa có
-- =====================================================
ALTER TABLE apishopee_flash_sale_auto_history
  ADD COLUMN IF NOT EXISTS lead_time_minutes integer DEFAULT 0;

-- =====================================================
-- 1. Tạo function trigger scheduler edge function
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_flash_sale_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url TEXT := 'https://ohlwhhxhgpotlwfgqhhu.supabase.co/functions/v1/apishopee-flash-sale-scheduler';
  service_role_key TEXT;
BEGIN
  -- Lấy service role key từ vault
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  -- Fire-and-forget: edge function tự xử lý batching nội bộ
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );

  RAISE NOTICE 'Flash sale scheduler triggered';
END;
$$;

-- =====================================================
-- 2. Xóa cron job cũ nếu tồn tại
-- =====================================================
DO $$
BEGIN
  PERFORM cron.unschedule('flash-sale-scheduler-job');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- =====================================================
-- 3. Tạo cron job chạy mỗi 2 phút
-- =====================================================
SELECT cron.schedule(
  'flash-sale-scheduler-job',
  '*/2 * * * *',
  'SELECT trigger_flash_sale_scheduler();'
);

-- =====================================================
-- 4. Comments
-- =====================================================
COMMENT ON FUNCTION trigger_flash_sale_scheduler() IS
'Trigger flash sale auto-scheduler edge function mỗi 2 phút via pg_cron.
- Không loop qua shops - edge function tự xử lý batching nội bộ
- Single HTTP call, timeout 180s
- Edge function xử lý: pick jobs, optimistic lock, batch 5 shops/lần, retry logic';
