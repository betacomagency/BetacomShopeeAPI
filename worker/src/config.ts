import dotenv from 'dotenv';
import path from 'path';

// Load .env from worker directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const config = {
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  shopeeBaseUrl: process.env.SHOPEE_BASE_URL || 'https://partner.shopeemobile.com',
  flashSaleAlertWebhook: process.env.FLASH_SALE_ALERT_WEBHOOK || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};
