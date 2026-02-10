/**
 * Types cho Multi-App Support
 * Partner Apps registry + Shop-App token management
 */

export interface PartnerApp {
  id: string;
  partner_id: number;
  partner_key: string;
  partner_name: string;
  app_category: 'erp' | 'ads';
  description: string | null;
  is_test: boolean;
  test_partner_id: number | null;
  test_partner_key: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopAppToken {
  id: string;
  shop_id: number;
  partner_app_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expire_in: number | null;
  expired_at: number | null;
  access_token_expired_at: number | null;
  auth_time: number | null;
  expire_time: number | null;
  merchant_id: number | null;
  token_updated_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  apishopee_partner_apps?: PartnerApp;
}

export interface ShopAppAuthStatus {
  partner_app: PartnerApp;
  token: ShopAppToken | null;
  is_authorized: boolean;
  token_status: 'active' | 'expiring' | 'expired' | 'not_authorized';
}

export type AppCategory = 'erp' | 'ads';

export const APP_CATEGORY_LABELS: Record<AppCategory, string> = {
  erp: 'ERP System',
  ads: 'Ads Service',
};

export const APP_CATEGORY_COLORS: Record<AppCategory, string> = {
  erp: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ads: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};
