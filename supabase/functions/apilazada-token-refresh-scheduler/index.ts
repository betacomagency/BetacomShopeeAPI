// Supabase Edge Function: Lazada Token Refresh Scheduler
// Cron job để tự động refresh tokens sắp hết hạn
// Schedule: Chạy mỗi 6 giờ (Cron: 0 0,6,12,18 * * *)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supabase config
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[LAZADA-SCHEDULER] Starting token refresh job...');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Gọi apilazada-auth với action refresh-all-expiring
    const { data, error } = await supabase.functions.invoke('apilazada-auth', {
      body: {
        action: 'refresh-all-expiring',
        buffer_hours: 24, // Refresh tokens sắp hết hạn trong 24 giờ
      },
    });

    if (error) {
      console.error('[LAZADA-SCHEDULER] Error calling refresh function:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[LAZADA-SCHEDULER] Refresh result:', data);

    // Log kết quả
    const logEntry = {
      job_type: 'lazada_token_refresh',
      executed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      result: data,
      success: true,
    };

    // Lưu log vào database (optional - tạo table nếu cần)
    try {
      await supabase.from('apilazada_scheduler_logs').insert(logEntry);
    } catch (logError) {
      // Table có thể chưa tồn tại, bỏ qua lỗi
      console.log('[LAZADA-SCHEDULER] Could not save log:', logError);
    }

    // Nếu có tokens refresh thất bại, gửi notification (optional)
    if (data?.failed > 0) {
      console.warn(`[LAZADA-SCHEDULER] ${data.failed} tokens failed to refresh`);

      // Có thể thêm logic gửi email/notification ở đây
      const failedShops = data.results?.filter((r: { success: boolean }) => !r.success) || [];
      for (const shop of failedShops) {
        console.error(`[LAZADA-SCHEDULER] Failed shop ${shop.seller_id}: ${shop.error}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refreshed ${data?.refreshed || 0} tokens, ${data?.failed || 0} failed`,
        data,
        duration_ms: Date.now() - startTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[LAZADA-SCHEDULER] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
