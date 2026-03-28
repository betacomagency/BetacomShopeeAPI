/**
 * Activity logger — ported from supabase/functions/_shared/activity-logger.ts
 * Writes to system_activity_logs table for tracking job execution.
 */
import { SupabaseClient } from '@supabase/supabase-js';

// ==================== TYPES ====================

export type ActionCategory = 'reviews' | 'flash_sale' | 'orders' | 'products' | 'system' | 'auth';
export type ActionStatus = 'pending' | 'success' | 'failed' | 'cancelled';
export type ActionSource = 'manual' | 'scheduled' | 'auto' | 'webhook' | 'api';

export interface LogActivityParams {
  userId?: string;
  userEmail?: string;
  shopId?: number;
  actionType: string;
  actionCategory: ActionCategory;
  status: ActionStatus;
  source: ActionSource;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
  ipAddress?: string;
}

// ==================== EXPORTS ====================

/**
 * Insert activity log row. Returns {success, id?, error?}
 */
export async function logActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('system_activity_logs')
      .insert({
        user_id: params.userId,
        user_email: params.userEmail,
        shop_id: params.shopId,
        action_type: params.actionType,
        action_category: params.actionCategory,
        status: params.status,
        source: params.source,
        request_data: params.requestData,
        response_data: params.responseData,
        error_message: params.errorMessage,
        duration_ms: params.durationMs,
        ip_address: params.ipAddress,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Update existing activity log status.
 */
export async function updateActivityStatus(
  supabase: SupabaseClient,
  logId: string,
  status: ActionStatus,
  options?: { errorMessage?: string; responseData?: Record<string, unknown>; durationMs?: number }
): Promise<void> {
  await supabase
    .from('system_activity_logs')
    .update({
      status,
      error_message: options?.errorMessage,
      response_data: options?.responseData,
      duration_ms: options?.durationMs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId);
}

/**
 * Stateful activity tracker — start() then success() or fail().
 */
export class ActivityTracker {
  private logId?: string;
  private startedAt: number;

  constructor(
    private supabase: SupabaseClient,
    private params: Omit<LogActivityParams, 'status' | 'durationMs'>
  ) {
    this.startedAt = Date.now();
  }

  async start(): Promise<string | undefined> {
    const result = await logActivity(this.supabase, {
      ...this.params,
      status: 'pending',
    });
    this.logId = result.id;
    return this.logId;
  }

  async success(responseData?: Record<string, unknown>): Promise<void> {
    if (!this.logId) return;
    await updateActivityStatus(this.supabase, this.logId, 'success', {
      responseData,
      durationMs: Date.now() - this.startedAt,
    });
  }

  async fail(errorMessage: string, responseData?: Record<string, unknown>): Promise<void> {
    if (!this.logId) return;
    await updateActivityStatus(this.supabase, this.logId, 'failed', {
      errorMessage,
      responseData,
      durationMs: Date.now() - this.startedAt,
    });
  }

  getLogId(): string | undefined {
    return this.logId;
  }
}

/**
 * One-shot log of a completed action.
 */
export async function logCompletedActivity(
  supabase: SupabaseClient,
  params: LogActivityParams
): Promise<void> {
  await logActivity(supabase, params);
}

/**
 * Get shop name for logging context.
 */
export async function getShopInfo(
  supabase: SupabaseClient,
  shopId: number
): Promise<{ shopName?: string }> {
  const { data } = await supabase
    .from('apishopee_shops')
    .select('shop_name')
    .eq('shop_id', shopId)
    .single();
  return { shopName: data?.shop_name };
}
