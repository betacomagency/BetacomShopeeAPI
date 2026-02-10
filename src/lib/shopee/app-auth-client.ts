/**
 * Multi-App Auth Client
 * Functions cho partner apps registry và shop-app token management
 */

import { supabase } from '../supabase';
import type { PartnerApp, ShopAppToken, ShopAppAuthStatus } from './partner-apps';

// ==================== Partner Apps ====================

/**
 * Lấy danh sách partner apps đang active
 */
export async function getPartnerApps(): Promise<PartnerApp[]> {
  const { data, error } = await supabase
    .from('apishopee_partner_apps')
    .select('*')
    .eq('is_active', true)
    .order('app_category');

  if (error) throw error;
  return (data || []) as PartnerApp[];
}

/**
 * Lấy tất cả partner apps (bao gồm inactive) - admin only
 */
export async function getAllPartnerApps(): Promise<PartnerApp[]> {
  const { data, error } = await supabase
    .from('apishopee_partner_apps')
    .select('*')
    .order('app_category');

  if (error) throw error;
  return (data || []) as PartnerApp[];
}

/**
 * Tạo partner app mới - admin only
 */
export async function createPartnerApp(app: Partial<PartnerApp>): Promise<PartnerApp> {
  const { data, error } = await supabase
    .from('apishopee_partner_apps')
    .insert(app)
    .select()
    .single();

  if (error) throw error;
  return data as PartnerApp;
}

/**
 * Cập nhật partner app - admin only
 */
export async function updatePartnerApp(id: string, updates: Partial<PartnerApp>): Promise<PartnerApp> {
  const { data, error } = await supabase
    .from('apishopee_partner_apps')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as PartnerApp;
}

/**
 * Xóa partner app - admin only
 */
export async function deletePartnerApp(id: string): Promise<void> {
  const { error } = await supabase
    .from('apishopee_partner_apps')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==================== Shop App Tokens ====================

/**
 * Lấy danh sách app tokens cho một shop
 */
export async function getShopAppTokens(shopId: number): Promise<ShopAppToken[]> {
  const { data, error } = await supabase
    .from('apishopee_shop_app_tokens')
    .select('*, apishopee_partner_apps(*)')
    .eq('shop_id', shopId);

  if (error) throw error;
  return (data || []) as ShopAppToken[];
}

/**
 * Lấy trạng thái authorization của tất cả apps cho một shop
 */
export async function getShopAppAuthStatuses(shopId: number): Promise<ShopAppAuthStatus[]> {
  const [apps, tokens] = await Promise.all([
    getPartnerApps(),
    getShopAppTokens(shopId),
  ]);

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  return apps.map(app => {
    const token = tokens.find(t => t.partner_app_id === app.id) || null;
    const isAuthorized = !!token?.access_token;

    let tokenStatus: ShopAppAuthStatus['token_status'] = 'not_authorized';
    if (isAuthorized && token?.expired_at) {
      if (token.expired_at < now) {
        tokenStatus = 'expired';
      } else if (token.expired_at < now + ONE_HOUR) {
        tokenStatus = 'expiring';
      } else {
        tokenStatus = 'active';
      }
    } else if (isAuthorized) {
      tokenStatus = 'active';
    }

    return { partner_app: app, token, is_authorized: isAuthorized, token_status: tokenStatus };
  });
}

// ==================== App-Specific OAuth ====================

/**
 * Lấy OAuth URL cho một partner app cụ thể
 */
export async function getAppAuthUrl(partnerAppId: string, redirectUri: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('apishopee-auth', {
    body: {
      action: 'get-app-auth-url',
      partner_app_id: partnerAppId,
      redirect_uri: redirectUri,
    },
  });

  if (error) throw new Error(error.message || 'Failed to get app auth URL');
  if (data?.error) throw new Error(data.message || data.error);

  return data.auth_url;
}

/**
 * Đổi code lấy token cho partner app cụ thể
 */
export async function authenticateApp(
  code: string,
  partnerAppId: string,
  shopId?: number,
  mainAccountId?: number
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('apishopee-auth', {
    body: {
      action: 'get-app-token',
      code,
      partner_app_id: partnerAppId,
      shop_id: shopId,
      main_account_id: mainAccountId,
    },
  });

  if (error) throw new Error(error.message || 'Failed to authenticate app');
  if (data?.error) throw new Error(data.message || data.error);

  return data;
}
