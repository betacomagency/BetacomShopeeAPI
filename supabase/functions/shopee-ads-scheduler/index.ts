/**
 * Supabase Edge Function: Shopee Ads Budget Scheduler
 * Tự động điều chỉnh ngân sách quảng cáo theo lịch
 *
 * OPTIMIZED FOR SCALE:
 * - Batch processing với timeout protection
 * - Concurrent shop processing với rate limiting
 * - Adaptive delay based on error rates
 * - Group schedules by shop để giảm credential lookups
 *
 * Actions:
 * - create: Tạo cấu hình lịch ngân sách mới
 * - update: Cập nhật cấu hình
 * - delete: Xóa cấu hình
 * - list: Xem danh sách cấu hình
 * - logs: Xem lịch sử thay đổi
 * - process: Xử lý điều chỉnh ngân sách (gọi bởi cron mỗi 30 phút)
 * - run-now: Test chạy ngay một schedule
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logApiCall, getApiCallStatus } from '../_shared/api-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';

/**
 * Fetch with proxy support for static IP
 * Supabase Edge Functions không có static IP, cần route qua proxy server
 */
async function fetchWithProxy(
  targetUrl: string,
  options: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  const fetchOptions = signal ? { ...options, signal } : options;

  if (PROXY_URL) {
    // Route through proxy server with static IP
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    console.log('[scheduler] Using proxy:', PROXY_URL);
    return await fetch(proxyUrl, fetchOptions);
  }

  // Direct fetch (will fail if IP not whitelisted)
  console.log('[scheduler] Warning: No PROXY_URL configured, calling Shopee directly');
  return await fetch(targetUrl, fetchOptions);
}

// ================== CONFIGURATION ==================
const CONFIG = {
  // Rate limiting
  BASE_DELAY_MS: 500,
  MAX_DELAY_MS: 5000,
  DELAY_INCREMENT_MS: 200,

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,

  // Timeout settings
  REQUEST_TIMEOUT_MS: 15000,
  BATCH_TIMEOUT_MS: 50000,

  // Concurrent processing
  MAX_CONCURRENT_SHOPS: 3,
  MAX_CAMPAIGNS_PER_BATCH: 50,

  // Error thresholds
  ERROR_RATE_THRESHOLD: 0.5,
};

// ================== UTILITIES ==================
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ================== ACTIVITY LOGGING (INLINED) ==================
async function logActivity(
  supabase: SupabaseClient,
  params: {
    shopId?: number;
    shopName?: string;
    actionType: string;
    actionCategory: string;
    actionDescription: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    requestData?: Record<string, unknown>;
    responseData?: Record<string, unknown>;
    status?: string;
    errorMessage?: string;
    source?: string;
    durationMs?: number;
  }
): Promise<void> {
  try {
    await supabase.from('system_activity_logs').insert({
      shop_id: params.shopId || null,
      shop_name: params.shopName || null,
      action_type: params.actionType,
      action_category: params.actionCategory,
      action_description: params.actionDescription,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      target_name: params.targetName || null,
      request_data: params.requestData || null,
      response_data: params.responseData || null,
      status: params.status || 'pending',
      error_message: params.errorMessage || null,
      source: params.source || 'auto',
      duration_ms: params.durationMs || null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[activity-log] Error:', err);
  }
}

async function getShopName(supabase: SupabaseClient, shopId: number): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('apishopee_shops')
      .select('shop_name')
      .eq('shop_id', shopId)
      .single();
    return data?.shop_name || null;
  } catch {
    return null;
  }
}

// ================== TYPES ==================
interface ShopCredentials {
  access_token: string;
  partner_id: number;
  partner_key: string;
}

interface Schedule {
  id: string;
  shop_id: number;
  campaign_id: number;
  campaign_name: string | null;
  ad_type: 'auto' | 'manual';
  hour_start: number;
  hour_end: number;
  minute_start: number;
  minute_end: number;
  budget: number;
  days_of_week: number[] | null;
  specific_dates: string[] | null;
}

interface ProcessResult {
  schedule_id: string;
  shop_id: number;
  campaign_id: number;
  budget: number;
  success: boolean;
  error?: string;
  retried?: number;
  skipped?: boolean;
  skip_reason?: string;
}

interface ErrorClassification {
  isRetryable: boolean;
  isRateLimit: boolean;
  isAuthError: boolean;
  isIpWhitelistError: boolean;
  isCampaignError: boolean;
  friendlyMessage: string;
}

// ================== CREDENTIAL CACHE ==================
const credentialCache = new Map<number, ShopCredentials | null>();

async function getShopCredentials(
  supabase: SupabaseClient,
  shopId: number
): Promise<ShopCredentials | null> {
  if (credentialCache.has(shopId)) {
    return credentialCache.get(shopId) || null;
  }

  const { data: shop, error } = await supabase
    .from('apishopee_shops')
    .select('access_token, partner_id, partner_key')
    .eq('shop_id', shopId)
    .single();

  if (error || !shop || !shop.access_token || !shop.partner_id || !shop.partner_key) {
    credentialCache.set(shopId, null);
    return null;
  }

  const credentials: ShopCredentials = {
    access_token: shop.access_token,
    partner_id: shop.partner_id,
    partner_key: shop.partner_key,
  };

  credentialCache.set(shopId, credentials);
  return credentials;
}

// ================== ERROR CLASSIFICATION ==================
function classifyError(errorCode: string, errorMessage: string): ErrorClassification {
  const lowerMessage = (errorMessage || '').toLowerCase();

  if (lowerMessage.includes('ip') && lowerMessage.includes('undeclared')) {
    return {
      isRetryable: false,
      isRateLimit: false,
      isAuthError: false,
      isIpWhitelistError: true,
      isCampaignError: false,
      friendlyMessage: 'IP chưa được whitelist trên Shopee Partner Console',
    };
  }

  if (errorCode === 'error_rate_limit') {
    return {
      isRetryable: true,
      isRateLimit: true,
      isAuthError: false,
      isIpWhitelistError: false,
      isCampaignError: false,
      friendlyMessage: 'Quá nhiều request - đang chờ retry',
    };
  }

  if (errorCode === 'error_auth' || errorCode === 'error_permission') {
    return {
      isRetryable: false,
      isRateLimit: false,
      isAuthError: true,
      isIpWhitelistError: false,
      isCampaignError: false,
      friendlyMessage: 'Lỗi xác thực - Token hết hạn hoặc không hợp lệ',
    };
  }

  if (errorCode === 'error_server') {
    return {
      isRetryable: true,
      isRateLimit: false,
      isAuthError: false,
      isIpWhitelistError: false,
      isCampaignError: false,
      friendlyMessage: 'Lỗi server Shopee - đang retry',
    };
  }

  const campaignErrors: Record<string, string> = {
    'ads.error_budget_too_low': 'Ngân sách quá thấp (tối thiểu 100.000đ)',
    'ads.error_budget_too_high': 'Ngân sách vượt quá giới hạn cho phép',
    'ads.error_campaign_not_found': 'Không tìm thấy chiến dịch quảng cáo',
    'ads.error_campaign_status': 'Trạng thái chiến dịch không cho phép thay đổi ngân sách',
    'error_not_found': 'Không tìm thấy chiến dịch',
  };

  if (campaignErrors[errorCode]) {
    return {
      isRetryable: false,
      isRateLimit: false,
      isAuthError: false,
      isIpWhitelistError: false,
      isCampaignError: true,
      friendlyMessage: campaignErrors[errorCode],
    };
  }

  return {
    isRetryable: false,
    isRateLimit: false,
    isAuthError: false,
    isIpWhitelistError: false,
    isCampaignError: false,
    friendlyMessage: `${errorMessage} (code: ${errorCode})`,
  };
}

// ================== SHOPEE API ==================
interface EditBudgetResult {
  success: boolean;
  error?: string;
  errorClassification?: ErrorClassification;
  retried?: number;
}

async function editCampaignBudget(
  credentials: ShopCredentials,
  shopId: number,
  campaignId: number,
  adType: 'auto' | 'manual',
  budget: number,
  retryCount = 0
): Promise<EditBudgetResult> {
  try {
    const apiPath = adType === 'manual'
      ? '/api/v2/ads/edit_manual_product_ads'
      : '/api/v2/ads/edit_auto_product_ads';

    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${credentials.partner_id}${apiPath}${timestamp}${credentials.access_token}${shopId}`;
    const sign = await hmacSha256(credentials.partner_key, baseString);

    const queryParams = new URLSearchParams();
    queryParams.set('partner_id', credentials.partner_id.toString());
    queryParams.set('timestamp', timestamp.toString());
    queryParams.set('access_token', credentials.access_token);
    queryParams.set('shop_id', shopId.toString());
    queryParams.set('sign', sign);

    const url = `${SHOPEE_HOST}${apiPath}?${queryParams.toString()}`;

    const body = {
      reference_id: `scheduler-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      campaign_id: campaignId,
      edit_action: 'change_budget',
      budget: budget,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchWithProxy(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, controller.signal);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const err = fetchError as Error;

      if (err.name === 'AbortError') {
        if (retryCount < CONFIG.MAX_RETRIES) {
          const retryDelay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
          await delay(retryDelay);
          return editCampaignBudget(credentials, shopId, campaignId, adType, budget, retryCount + 1);
        }
        return { success: false, error: `Request timeout`, retried: retryCount };
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    const result = await response.json();

    if (result.error && result.error !== '' && result.error !== '-') {
      const errorCode = result.error;
      const errorMsg = result.message || result.error;
      const classification = classifyError(errorCode, errorMsg);

      if (classification.isRetryable && retryCount < CONFIG.MAX_RETRIES) {
        const retryDelay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        if (classification.isRateLimit) {
          await delay(retryDelay * 2);
        } else {
          await delay(retryDelay);
        }
        return editCampaignBudget(credentials, shopId, campaignId, adType, budget, retryCount + 1);
      }

      return {
        success: false,
        error: classification.friendlyMessage,
        errorClassification: classification,
        retried: retryCount,
      };
    }

    if (!result.response) {
      return { success: false, error: 'Shopee API không trả về dữ liệu', retried: retryCount };
    }

    return { success: true, retried: retryCount };
  } catch (err) {
    return { success: false, error: `Lỗi: ${(err as Error).message}`, retried: retryCount };
  }
}

// ================== SCHEDULE PROCESSING ==================
function groupSchedulesByShop(schedules: Schedule[]): Map<number, Schedule[]> {
  const grouped = new Map<number, Schedule[]>();
  for (const schedule of schedules) {
    const existing = grouped.get(schedule.shop_id) || [];
    existing.push(schedule);
    grouped.set(schedule.shop_id, existing);
  }
  return grouped;
}

async function processShopSchedules(
  supabase: SupabaseClient,
  shopId: number,
  schedules: Schedule[],
  currentDelayMs: number
): Promise<{ results: ProcessResult[]; newDelayMs: number; errorCount: number }> {
  const results: ProcessResult[] = [];
  let delayMs = currentDelayMs;
  let errorCount = 0;

  const credentials = await getShopCredentials(supabase, shopId);

  if (!credentials) {
    return {
      results: schedules.map(s => ({
        schedule_id: s.id,
        shop_id: s.shop_id,
        campaign_id: s.campaign_id,
        budget: s.budget,
        success: false,
        error: 'Shop credentials không hợp lệ',
        skipped: true,
        skip_reason: 'invalid_credentials',
      })),
      newDelayMs: delayMs,
      errorCount: schedules.length,
    };
  }

  const shopName = await getShopName(supabase, shopId);

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules[i];

    if (i > 0) await delay(delayMs);

    const startTime = Date.now();
    const result = await editCampaignBudget(
      credentials,
      shopId,
      schedule.campaign_id,
      schedule.ad_type,
      schedule.budget
    );
    const durationMs = Date.now() - startTime;

    // Log API call
    const apiPath = schedule.ad_type === 'manual' ? '/api/v2/ads/edit_manual_product_ads' : '/api/v2/ads/edit_auto_product_ads';
    logApiCall(supabase, {
      shopId,
      edgeFunction: 'shopee-ads-scheduler',
      apiEndpoint: apiPath,
      httpMethod: 'POST',
      apiCategory: 'ads',
      status: result.success ? 'success' : 'failed',
      shopeeError: result.success ? undefined : result.error,
      durationMs,
      retryCount: result.retried,
    });

    if (!result.success) {
      errorCount++;

      if (result.errorClassification?.isRateLimit) {
        delayMs = Math.min(delayMs + CONFIG.DELAY_INCREMENT_MS * 2, CONFIG.MAX_DELAY_MS);
      } else if (result.errorClassification?.isIpWhitelistError || result.errorClassification?.isAuthError) {
        results.push({
          schedule_id: schedule.id,
          shop_id: shopId,
          campaign_id: schedule.campaign_id,
          budget: schedule.budget,
          success: false,
          error: result.error,
          retried: result.retried,
        });

        for (let j = i + 1; j < schedules.length; j++) {
          results.push({
            schedule_id: schedules[j].id,
            shop_id: shopId,
            campaign_id: schedules[j].campaign_id,
            budget: schedules[j].budget,
            success: false,
            error: `Skipped - ${result.errorClassification.isIpWhitelistError ? 'IP whitelist' : 'Auth'} error`,
            skipped: true,
            skip_reason: result.errorClassification.isIpWhitelistError ? 'ip_whitelist_error' : 'auth_error',
          });
          errorCount++;
        }
        break;
      }
    } else {
      delayMs = Math.max(delayMs - 50, CONFIG.BASE_DELAY_MS);
    }

    results.push({
      schedule_id: schedule.id,
      shop_id: shopId,
      campaign_id: schedule.campaign_id,
      budget: schedule.budget,
      success: result.success,
      error: result.error,
      retried: result.retried,
    });

    // Log to database (fire and forget)
    Promise.all([
      supabase.from('apishopee_ads_budget_logs').insert({
        shop_id: shopId,
        campaign_id: schedule.campaign_id,
        campaign_name: schedule.campaign_name,
        schedule_id: schedule.id,
        new_budget: schedule.budget,
        status: result.success ? 'success' : 'failed',
        error_message: result.error || null,
      }),
      logActivity(supabase, {
        shopId,
        shopName: shopName || undefined,
        actionType: 'ads_budget_update',
        actionCategory: 'ads',
        actionDescription: `Cập nhật ngân sách "${schedule.campaign_name || schedule.campaign_id}" → ${schedule.budget.toLocaleString()}đ`,
        targetType: 'campaign',
        targetId: schedule.campaign_id.toString(),
        targetName: schedule.campaign_name || `Campaign ${schedule.campaign_id}`,
        requestData: { schedule_id: schedule.id, ad_type: schedule.ad_type, budget: schedule.budget },
        status: result.success ? 'success' : 'failed',
        errorMessage: result.error,
        source: 'scheduled',
        durationMs,
      }),
    ]).catch(console.error);
  }

  return { results, newDelayMs: delayMs, errorCount };
}

// ================== MAIN HANDLER ==================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { action, shop_id, ...params } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (action) {
      case 'create': {
        const { campaign_id, campaign_name, ad_type, hour_start, hour_end, minute_start, minute_end, budget, days_of_week, specific_dates } = params;

        if (!shop_id || !campaign_id || !ad_type || hour_start === undefined || hour_end === undefined || !budget) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('apishopee_scheduled_ads_budget')
          .upsert({
            shop_id,
            campaign_id,
            campaign_name: campaign_name || null,
            ad_type,
            hour_start,
            hour_end,
            minute_start: minute_start ?? 0,
            minute_end: minute_end ?? 0,
            budget,
            days_of_week: days_of_week || null,
            specific_dates: specific_dates || null,
            is_active: true,
          }, { onConflict: 'shop_id,campaign_id,hour_start,minute_start', ignoreDuplicates: false })
          .select()
          .single();

        return new Response(
          JSON.stringify({ success: !error, schedule: data, error: error?.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { schedule_id, ...updateData } = params;

        if (!schedule_id || !shop_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'schedule_id and shop_id are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const cleanData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== undefined) cleanData[key] = value;
        }

        const { data, error } = await supabase
          .from('apishopee_scheduled_ads_budget')
          .update(cleanData)
          .eq('id', schedule_id)
          .eq('shop_id', shop_id)
          .select()
          .single();

        return new Response(
          JSON.stringify({ success: !error, schedule: data, error: error?.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { schedule_id } = params;

        if (!schedule_id || !shop_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'schedule_id and shop_id are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('apishopee_scheduled_ads_budget')
          .delete()
          .eq('id', schedule_id)
          .eq('shop_id', shop_id);

        return new Response(
          JSON.stringify({ success: !error, error: error?.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        let query = supabase
          .from('apishopee_scheduled_ads_budget')
          .select('*')
          .eq('shop_id', shop_id)
          .order('campaign_id')
          .order('hour_start');

        if (params.campaign_id) query = query.eq('campaign_id', params.campaign_id);

        const { data, error } = await query;

        return new Response(
          JSON.stringify({ success: !error, schedules: data || [], error: error?.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logs': {
        let query = supabase
          .from('apishopee_ads_budget_logs')
          .select('*')
          .eq('shop_id', shop_id)
          .order('executed_at', { ascending: false })
          .limit(params.limit || 50);

        if (params.campaign_id) query = query.eq('campaign_id', params.campaign_id);

        const { data, error } = await query;

        return new Response(
          JSON.stringify({ success: !error, logs: data || [], error: error?.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'process': {
        const now = new Date();
        const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const currentHour = vnTime.getHours();
        const currentMinute = vnTime.getMinutes();
        const currentDay = vnTime.getDay();
        const today = vnTime.toISOString().split('T')[0];
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        console.log(`[scheduler] ${currentHour}:${currentMinute.toString().padStart(2, '0')} VN, day=${currentDay}`);

        const { data: schedules, error: scheduleError } = await supabase
          .from('apishopee_scheduled_ads_budget')
          .select('*')
          .eq('is_active', true);

        if (scheduleError) {
          return new Response(
            JSON.stringify({ success: false, error: scheduleError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentSlotStart = currentHour * 60 + (currentMinute < 30 ? 0 : 30);
        const currentSlotEnd = currentSlotStart + 30;

        const applicableSchedules = (schedules || []).filter((s: Schedule) => {
          const startMinutes = s.hour_start * 60 + (s.minute_start || 0);
          const endMinutes = s.hour_end * 60 + (s.minute_end || 0);

          const isScheduleStartInCurrentSlot = startMinutes >= currentSlotStart && startMinutes < currentSlotEnd;
          const isBeforeEndTime = currentTotalMinutes < endMinutes;

          if (!isScheduleStartInCurrentSlot || !isBeforeEndTime) return false;

          if (s.specific_dates?.length) return s.specific_dates.includes(today);
          if (s.days_of_week?.length && s.days_of_week.length < 7) return s.days_of_week.includes(currentDay);

          return true;
        }) as Schedule[];

        console.log(`[scheduler] ${applicableSchedules.length}/${schedules?.length || 0} schedules applicable`);

        if (applicableSchedules.length === 0) {
          return new Response(
            JSON.stringify({ success: true, processed: 0, message: 'No schedules for current slot' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const schedulesToProcess = applicableSchedules.slice(0, CONFIG.MAX_CAMPAIGNS_PER_BATCH);
        const groupedSchedules = groupSchedulesByShop(schedulesToProcess);
        const shopIds = Array.from(groupedSchedules.keys());

        console.log(`[scheduler] Processing ${schedulesToProcess.length} schedules across ${shopIds.length} shops`);

        const allResults: ProcessResult[] = [];
        let currentDelayMs = CONFIG.BASE_DELAY_MS;
        let totalErrors = 0;

        for (let i = 0; i < shopIds.length; i += CONFIG.MAX_CONCURRENT_SHOPS) {
          if (Date.now() - startTime > CONFIG.BATCH_TIMEOUT_MS) {
            console.log(`[scheduler] Timeout reached`);
            for (let j = i; j < shopIds.length; j++) {
              const remaining = groupedSchedules.get(shopIds[j]) || [];
              for (const s of remaining) {
                allResults.push({
                  schedule_id: s.id,
                  shop_id: s.shop_id,
                  campaign_id: s.campaign_id,
                  budget: s.budget,
                  success: false,
                  error: 'Timeout - will retry next cycle',
                  skipped: true,
                  skip_reason: 'batch_timeout',
                });
              }
            }
            break;
          }

          const batchShopIds = shopIds.slice(i, i + CONFIG.MAX_CONCURRENT_SHOPS);
          const batchResults = await Promise.all(
            batchShopIds.map(shopId =>
              processShopSchedules(supabase, shopId, groupedSchedules.get(shopId) || [], currentDelayMs)
            )
          );

          for (const { results, newDelayMs, errorCount } of batchResults) {
            allResults.push(...results);
            currentDelayMs = Math.max(currentDelayMs, newDelayMs);
            totalErrors += errorCount;
          }

          if (totalErrors / allResults.length > CONFIG.ERROR_RATE_THRESHOLD) {
            console.log(`[scheduler] High error rate, slowing down`);
            await delay(CONFIG.MAX_DELAY_MS);
          }
        }

        const successCount = allResults.filter(r => r.success).length;
        const failureCount = allResults.filter(r => !r.success && !r.skipped).length;
        const skippedCount = allResults.filter(r => r.skipped).length;

        console.log(`[scheduler] Done: ${successCount} ok, ${failureCount} failed, ${skippedCount} skipped`);

        return new Response(
          JSON.stringify({
            success: true,
            processed: allResults.length,
            success_count: successCount,
            failure_count: failureCount,
            skipped_count: skippedCount,
            duration_ms: Date.now() - startTime,
            results: allResults,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'run-now': {
        const { schedule_id } = params;

        if (!schedule_id || !shop_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'schedule_id and shop_id are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: schedule, error: scheduleError } = await supabase
          .from('apishopee_scheduled_ads_budget')
          .select('*')
          .eq('id', schedule_id)
          .eq('shop_id', shop_id)
          .single();

        if (scheduleError || !schedule) {
          return new Response(
            JSON.stringify({ success: false, error: 'Schedule not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const credentials = await getShopCredentials(supabase, shop_id);

        if (!credentials) {
          return new Response(
            JSON.stringify({ success: false, error: 'Shop credentials không hợp lệ' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const apiStartTime = Date.now();
        const result = await editCampaignBudget(
          credentials,
          shop_id,
          schedule.campaign_id,
          schedule.ad_type as 'auto' | 'manual',
          schedule.budget
        );
        const durationMs = Date.now() - apiStartTime;

        // Log API call
        const runNowApiPath = (schedule.ad_type as string) === 'manual' ? '/api/v2/ads/edit_manual_product_ads' : '/api/v2/ads/edit_auto_product_ads';
        logApiCall(supabase, {
          shopId: shop_id,
          edgeFunction: 'shopee-ads-scheduler',
          apiEndpoint: runNowApiPath,
          httpMethod: 'POST',
          apiCategory: 'ads',
          status: result.success ? 'success' : 'failed',
          shopeeError: result.success ? undefined : result.error,
          durationMs,
          retryCount: result.retried,
        });

        const shopName = await getShopName(supabase, shop_id);

        Promise.all([
          supabase.from('apishopee_ads_budget_logs').insert({
            shop_id,
            campaign_id: schedule.campaign_id,
            campaign_name: schedule.campaign_name,
            schedule_id: schedule.id,
            new_budget: schedule.budget,
            status: result.success ? 'success' : 'failed',
            error_message: result.error || null,
          }),
          logActivity(supabase, {
            shopId: shop_id,
            shopName: shopName || undefined,
            actionType: 'ads_budget_update',
            actionCategory: 'ads',
            actionDescription: `[Manual] Cập nhật ngân sách "${schedule.campaign_name || schedule.campaign_id}" → ${schedule.budget.toLocaleString()}đ`,
            targetType: 'campaign',
            targetId: schedule.campaign_id.toString(),
            targetName: schedule.campaign_name || `Campaign ${schedule.campaign_id}`,
            requestData: { schedule_id: schedule.id, ad_type: schedule.ad_type, budget: schedule.budget, trigger: 'run-now' },
            status: result.success ? 'success' : 'failed',
            errorMessage: result.error,
            source: 'manual',
            durationMs,
          }),
        ]).catch(console.error);

        return new Response(
          JSON.stringify({
            success: result.success,
            error: result.error,
            campaign_id: schedule.campaign_id,
            budget: schedule.budget,
            duration_ms: durationMs,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (err) {
    console.error('[scheduler] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, duration_ms: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
