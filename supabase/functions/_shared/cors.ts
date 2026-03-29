/**
 * Shared CORS headers for all Edge Functions
 * Set ALLOWED_ORIGIN env var in production to restrict cross-origin access.
 * Falls back to '*' only for local development.
 */

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';

if (allowedOrigin === '*') {
  console.warn('[CORS] ALLOWED_ORIGIN not set — using wildcard. Set this env var in production!');
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
