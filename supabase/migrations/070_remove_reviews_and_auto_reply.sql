-- Remove all reviews and auto-reply related objects
-- Reviews/auto-reply features are not in use, cleaning up code and DB

-- 1. Unschedule cron jobs
SELECT cron.unschedule('reviews-sync-job');
SELECT cron.unschedule('auto-reply-reviews-job');

-- 2. Drop auto-reply tables (depends on reviews, drop first)
DROP TABLE IF EXISTS apishopee_auto_reply_logs CASCADE;
DROP TABLE IF EXISTS apishopee_auto_reply_job_status CASCADE;
DROP TABLE IF EXISTS apishopee_auto_reply_config CASCADE;

-- 3. Drop reviews tables
DROP TABLE IF EXISTS apishopee_reviews_sync_status CASCADE;
DROP TABLE IF EXISTS apishopee_reviews CASCADE;

-- 4. Drop related functions
DROP FUNCTION IF EXISTS sync_all_shops_reviews() CASCADE;
DROP FUNCTION IF EXISTS process_all_auto_reply_jobs() CASCADE;
DROP FUNCTION IF EXISTS get_random_reply_template(jsonb, integer) CASCADE;
DROP FUNCTION IF EXISTS get_reviews_need_auto_reply(bigint, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS update_reviews_updated_at() CASCADE;
