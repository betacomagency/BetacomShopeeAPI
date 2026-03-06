/**
 * API Logger - Shared utility for logging Shopee API calls
 * Ghi log từng lệnh gọi Shopee API vào bảng api_call_logs
 * Non-blocking: không làm chậm response chính
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ApiCategory = 'shop' | 'product' | 'flash_sale' | 'review' | 'auth' | 'order' | 'finance';
export type ApiCallStatus = 'success' | 'failed' | 'timeout';
export type TriggeredBy = 'user' | 'cron' | 'scheduler' | 'webhook' | 'system';

export interface LogApiCallParams {
  shopId?: number;
  partnerId?: number;
  edgeFunction: string;
  apiEndpoint: string;
  httpMethod?: string;
  apiCategory: ApiCategory;
  status: ApiCallStatus;
  shopeeError?: string;
  shopeeMessage?: string;
  httpStatusCode?: number;
  durationMs?: number;
  requestParams?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
  retryCount?: number;
  wasTokenRefreshed?: boolean;
  userId?: string;
  userEmail?: string;
  triggeredBy?: TriggeredBy;
}

/**
 * Sanitize params: loại bỏ tokens và keys nhạy cảm
 */
function sanitizeParams(params: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!params) return null;

  const sensitiveKeys = ['access_token', 'refresh_token', 'partner_key', 'sign', 'signature'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '***';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log một API call vào database (non-blocking)
 */
export function logApiCall(
  supabase: SupabaseClient,
  params: LogApiCallParams
): void {
  const insertData = {
    shop_id: params.shopId || null,
    partner_id: params.partnerId || null,
    edge_function: params.edgeFunction,
    api_endpoint: params.apiEndpoint,
    http_method: params.httpMethod || 'GET',
    api_category: params.apiCategory,
    status: params.status,
    shopee_error: params.shopeeError || null,
    shopee_message: params.shopeeMessage || null,
    http_status_code: params.httpStatusCode || null,
    duration_ms: params.durationMs || null,
    request_params: sanitizeParams(params.requestParams),
    response_summary: params.responseSummary || null,
    retry_count: params.retryCount || 0,
    was_token_refreshed: params.wasTokenRefreshed || false,
    user_id: params.userId || null,
    user_email: params.userEmail || null,
    triggered_by: params.triggeredBy || 'system',
  };

  // Non-blocking insert - fire and forget
  supabase
    .from('api_call_logs')
    .insert(insertData)
    .then(({ error }) => {
      if (error) {
        console.error('[API-LOG] Failed to insert log:', error.message);
      }
    });
}

/**
 * Xác định status từ Shopee API response
 */
export function getApiCallStatus(result: Record<string, unknown>): {
  status: ApiCallStatus;
  shopeeError?: string;
  shopeeMessage?: string;
} {
  if (!result) {
    return { status: 'failed', shopeeError: 'null_response', shopeeMessage: 'No response received' };
  }

  // Shopee trả về error = "" khi thành công
  const error = result.error as string | undefined;
  const message = result.message as string | undefined;

  if (!error || error === '') {
    return { status: 'success' };
  }

  return {
    status: 'failed',
    shopeeError: error,
    shopeeMessage: message || undefined,
  };
}

const MAX_RESPONSE_SIZE = 50 * 1024; // 50KB limit

/**
 * Tạo response summary đầy đủ từ Shopee API response
 * Lưu toàn bộ response data, truncate nếu vượt quá 50KB
 */
export function createResponseSummary(result: Record<string, unknown>): Record<string, unknown> {
  // Deep clone to avoid mutating the original
  const fullResponse = JSON.parse(JSON.stringify(result));

  // Sanitize sensitive fields in response
  sanitizeDeep(fullResponse);

  // Check size and truncate if needed
  const json = JSON.stringify(fullResponse);
  if (json.length > MAX_RESPONSE_SIZE) {
    // Fallback to lightweight summary if response is too large
    const summary: Record<string, unknown> = {
      _truncated: true,
      _original_size: json.length,
    };
    if (result.error !== undefined) summary.error = result.error;
    if (result.message !== undefined) summary.message = result.message;
    if (result.request_id !== undefined) summary.request_id = result.request_id;
    if (result.warning !== undefined) summary.warning = result.warning;

    if (result.response) {
      const resp = result.response as Record<string, unknown>;
      if (resp.total_count !== undefined) summary.total_count = resp.total_count;
      if (resp.has_next_page !== undefined) summary.has_next_page = resp.has_next_page;
      if (Array.isArray(resp.item_list)) summary.item_count = resp.item_list.length;
      if (Array.isArray(resp.item)) summary.item_count = resp.item.length;
    }
    return summary;
  }

  return fullResponse;
}

/**
 * Extract user info from JWT token (decode only, no verification)
 * JWT đã được Supabase gateway verify rồi nên an toàn để decode
 */
export function extractUserFromJwt(authHeader: string | null): { userId?: string; userEmail?: string } {
  if (!authHeader) return {};
  try {
    const token = authHeader.replace('Bearer ', '');
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    // Decode base64url payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    // Supabase user JWT has 'sub' (user_id) and usually 'email'
    // Anon key JWT has role='anon' but no 'sub'
    // Only require 'sub' to identify as user-triggered; email is optional
    if (payload.sub) {
      return { userId: payload.sub, userEmail: payload.email || undefined };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Determine triggered_by based on JWT extraction result
 * If userId exists from JWT -> 'user', otherwise use provided fallback
 */
export function determineTriggeredBy(
  jwtResult: { userId?: string; userEmail?: string },
  fallback: TriggeredBy = 'system'
): TriggeredBy {
  if (jwtResult.userId) return 'user';
  return fallback;
}

/**
 * Recursively sanitize sensitive fields in response data
 */
function sanitizeDeep(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) sanitizeDeep(item);
    return;
  }
  const sensitiveKeys = ['access_token', 'refresh_token', 'partner_key', 'sign', 'signature'];
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      record[key] = '***';
    } else if (typeof record[key] === 'object' && record[key] !== null) {
      sanitizeDeep(record[key]);
    }
  }
}
