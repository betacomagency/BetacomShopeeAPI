/**
 * API Logger - Shared utility for logging Shopee API calls
 * Ghi log từng lệnh gọi Shopee API vào bảng api_call_logs
 * Non-blocking: không làm chậm response chính
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ApiCategory = 'shop' | 'product' | 'flash_sale' | 'review' | 'auth' | 'order' | 'account_health' | 'finance';
export type ApiCallStatus = 'success' | 'failed' | 'timeout';

export interface LogApiCallParams {
  shopId?: number;
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

/**
 * Tạo response summary nhẹ từ Shopee API response
 * Chỉ giữ các field quan trọng, bỏ data nặng
 */
export function createResponseSummary(result: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  if (result.error !== undefined) summary.error = result.error;
  if (result.message !== undefined) summary.message = result.message;
  if (result.request_id !== undefined) summary.request_id = result.request_id;
  if (result.warning !== undefined) summary.warning = result.warning;

  // Item counts nếu có
  if (result.response) {
    const resp = result.response as Record<string, unknown>;
    if (resp.total_count !== undefined) summary.total_count = resp.total_count;
    if (resp.has_next_page !== undefined) summary.has_next_page = resp.has_next_page;
    if (Array.isArray(resp.item_list)) summary.item_count = resp.item_list.length;
    if (Array.isArray(resp.item)) summary.item_count = resp.item.length;
  }

  return summary;
}
