/**
 * API call logger — ported from supabase/functions/_shared/api-logger.ts
 * Fire-and-forget logging to api_call_logs table.
 * Sanitizes sensitive fields (access_token, partner_key, etc.)
 */
import { SupabaseClient } from '@supabase/supabase-js';

// ==================== TYPES ====================

export type ApiCategory = 'shop' | 'product' | 'flash_sale' | 'review' | 'auth' | 'order' | 'finance' | 'ads';
export type ApiCallStatus = 'success' | 'failed' | 'timeout';
export type TriggeredBy = 'user' | 'cron' | 'scheduler' | 'webhook' | 'system';

export interface LogApiCallParams {
  shopId?: number;
  partnerId?: number;
  edgeFunction: string;
  apiEndpoint: string;
  httpMethod: string;
  apiCategory: ApiCategory;
  status: ApiCallStatus;
  shopeeError?: string;
  shopeeMessage?: string;
  durationMs: number;
  responseSummary?: Record<string, unknown>;
  wasTokenRefreshed?: boolean;
  userId?: string;
  userEmail?: string;
  triggeredBy?: TriggeredBy;
}

// Sensitive keys to redact in logs
const SENSITIVE_KEYS = ['access_token', 'refresh_token', 'partner_key', 'sign', 'signature'];

// ==================== SANITIZATION ====================

function sanitizeDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDeep);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      result[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeDeep(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ==================== EXPORTS ====================

/**
 * Fire-and-forget insert into api_call_logs. Never blocks caller.
 */
export function logApiCall(supabase: SupabaseClient, params: LogApiCallParams): void {
  const sanitizedResponse = params.responseSummary
    ? sanitizeDeep(params.responseSummary)
    : undefined;

  supabase
    .from('api_call_logs')
    .insert({
      shop_id: params.shopId,
      partner_id: params.partnerId,
      edge_function: params.edgeFunction,
      api_endpoint: params.apiEndpoint,
      http_method: params.httpMethod,
      api_category: params.apiCategory,
      status: params.status,
      shopee_error: params.shopeeError,
      shopee_message: params.shopeeMessage,
      duration_ms: params.durationMs,
      response_summary: sanitizedResponse,
      was_token_refreshed: params.wasTokenRefreshed || false,
      user_id: params.userId,
      user_email: params.userEmail,
      triggered_by: params.triggeredBy || 'system',
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) console.error('[API-LOGGER] Insert error:', error.message);
    });
}

/**
 * Parse Shopee API response to determine call status.
 * Shopee returns error='' for success, non-empty string for failure.
 */
export function getApiCallStatus(result: Record<string, unknown>): {
  status: ApiCallStatus;
  shopeeError?: string;
  shopeeMessage?: string;
} {
  const error = result?.error as string;
  const message = result?.message as string;

  if (!error || error === '') {
    return { status: 'success' };
  }
  return {
    status: 'failed',
    shopeeError: error,
    shopeeMessage: message,
  };
}

/**
 * Create a sanitized, truncated response summary for logging.
 * Max 50KB to avoid DB bloat.
 */
export function createResponseSummary(result: Record<string, unknown>): Record<string, unknown> {
  try {
    const sanitized = sanitizeDeep(result) as Record<string, unknown>;
    const json = JSON.stringify(sanitized);

    if (json.length > 50000) {
      return {
        _truncated: true,
        error: sanitized.error,
        message: sanitized.message,
        _originalSize: json.length,
      };
    }
    return sanitized;
  } catch {
    return { _error: 'Failed to create response summary' };
  }
}

/**
 * Decode JWT payload (no verification — relies on Supabase gateway).
 * For worker context, this is mainly used for logging who triggered the action.
 */
export function extractUserFromJwt(authHeader?: string | null): {
  userId?: string;
  userEmail?: string;
} {
  if (!authHeader) return {};
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return { userId: payload.sub, userEmail: payload.email };
  } catch {
    return {};
  }
}

/**
 * Determine who triggered the action based on JWT result.
 */
export function determineTriggeredBy(
  jwtResult: { userId?: string; userEmail?: string },
  fallback: TriggeredBy = 'system'
): TriggeredBy {
  return jwtResult?.userId ? 'user' : fallback;
}
