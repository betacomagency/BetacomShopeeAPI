/**
 * Shopee API Client via Supabase Edge Functions
 * Gọi backend API để xử lý Shopee authentication
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import type { AccessToken, GetShopInfoResponse, GetShopsByPartnerResponse, GetMerchantsByPartnerResponse } from './types';

export { isSupabaseConfigured };

interface PartnerInfo {
  partner_id: number;
  partner_key: string;
  partner_name?: string;
  partner_created_by?: string;
}

/**
 * Lấy URL xác thực OAuth từ backend
 * @param redirectUri - URL callback sau khi authorize
 * @param partnerAccountId - (deprecated) ID của partner account
 * @param partnerInfo - Partner credentials trực tiếp
 */
export async function getAuthorizationUrl(
  redirectUri: string,
  partnerAccountId?: string,
  partnerInfo?: PartnerInfo
): Promise<string> {
  console.log('[Shopee] getAuthorizationUrl called');
  console.log('[Shopee] redirect_uri:', redirectUri);
  console.log('[Shopee] partnerInfo:', partnerInfo ? { 
    partner_id: partnerInfo.partner_id, 
    partner_key: partnerInfo.partner_key?.substring(0, 10) + '...',
    partner_name: partnerInfo.partner_name 
  } : null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured');
  }

  try {
    const functionUrl = `${supabaseUrl}/functions/v1/apishopee-auth`;
    console.log('[Shopee] Calling Edge Function directly:', functionUrl);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'get-auth-url',
        redirect_uri: redirectUri,
        partner_info: partnerInfo,
      }),
    });

    console.log('[Shopee] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Shopee] HTTP error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[Shopee] Edge Function response:', data);

    if (data.error) {
      console.error('[Shopee] Server returned error:', data.error, data.message);
      throw new Error(data.message || data.error || 'Server error');
    }

    if (!data.auth_url) {
      console.error('[Shopee] No auth_url in response:', data);
      throw new Error(data.message || 'No auth URL returned from server');
    }

    console.log('[Shopee] Got auth_url:', data.auth_url.substring(0, 100) + '...');
    return data.auth_url;
  } catch (err) {
    console.error('[Shopee] getAuthorizationUrl exception:', err);
    throw err;
  }
}

/**
 * Đổi code lấy access token
 * @param code - Authorization code từ callback
 * @param shopId - Shop ID (optional, cho shop-level auth)
 * @param partnerAccountId - (deprecated) ID của partner account
 * @param partnerInfo - Partner credentials trực tiếp
 * @param mainAccountId - Main account ID (cho main account auth)
 */
export async function authenticateWithCode(
  code: string,
  shopId?: number,
  partnerAccountId?: string,
  partnerInfo?: PartnerInfo,
  mainAccountId?: number
): Promise<AccessToken> {
  console.log('[Shopee] authenticateWithCode called:', { code: code.substring(0, 10) + '...', shopId, mainAccountId, partnerInfo });

  const { data, error } = await supabase.functions.invoke('apishopee-auth', {
    body: {
      action: 'get-token',
      code,
      shop_id: shopId,
      main_account_id: mainAccountId,
      partner_info: partnerInfo,
    },
  });

  console.log('[Shopee] authenticateWithCode response:', { data, error });

  if (error) {
    throw new Error(error.message || 'Failed to authenticate');
  }

  if (data.error) {
    throw new Error(data.message || data.error);
  }

  // Main account auth: shop_id có thể không có ở top level, nhưng có shop_id_list
  const token: AccessToken = {
    ...data,
    shop_id: data.shop_id || shopId,
  };

  console.log('[Shopee] Final token:', { shop_id: token.shop_id, merchant_id: token.merchant_id, shop_id_list: token.shop_id_list, has_access_token: !!token.access_token });

  return token;
}

/**
 * Refresh access token
 * Docs: chỉ truyền 1 trong 4 loại ID (shop_id / merchant_id / supplier_id / user_id)
 */
export async function refreshToken(
  currentRefreshToken: string,
  shopId?: number,
  merchantId?: number,
  supplierId?: number,
  userId?: number
): Promise<AccessToken> {
  const { data, error } = await supabase.functions.invoke('apishopee-auth', {
    body: {
      action: 'refresh-token',
      refresh_token: currentRefreshToken,
      shop_id: shopId,
      merchant_id: merchantId,
      supplier_id: supplierId,
      user_id: userId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to refresh token');
  }

  if (data.error) {
    throw new Error(data.message || data.error);
  }

  return data as AccessToken;
}

/**
 * Lấy token đã lưu từ database
 */
export async function getStoredTokenFromDB(shopId: number): Promise<AccessToken | null> {
  const { data, error } = await supabase.functions.invoke('apishopee-auth', {
    body: { action: 'get-stored-token', shop_id: shopId },
  });

  if (error || data?.error) {
    return null;
  }

  return data as AccessToken;
}

/**
 * Lấy danh sách shop đã ủy quyền cho partner app
 * Gọi Shopee API: GET /api/v2/public/get_shops_by_partner
 * @param partnerAppId - UUID từ bảng apishopee_partner_apps
 * @param pageSize - Số shop trên mỗi trang (mặc định 100)
 * @param pageNo - Số trang (bắt đầu từ 1)
 */
export async function getShopsByPartner(
  partnerAppId: string,
  pageSize = 100,
  pageNo = 1
): Promise<GetShopsByPartnerResponse> {
  const { data, error } = await supabase.functions.invoke('apishopee-proxy', {
    body: {
      api_path: '/api/v2/public/get_shops_by_partner',
      method: 'GET',
      partner_app_id: partnerAppId,
      params: {
        page_size: pageSize,
        page_no: pageNo,
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get shops by partner');
  }

  const responseData = data?.response?.data;

  if (responseData?.error) {
    throw new Error(responseData.message || responseData.error);
  }

  return responseData as GetShopsByPartnerResponse;
}

/**
 * Lấy TẤT CẢ shop đã ủy quyền cho partner app (tự động phân trang)
 * @param partnerAppId - UUID từ bảng apishopee_partner_apps
 * @param pageSize - Số shop trên mỗi trang (mặc định 100)
 */
export async function getAllShopsByPartner(
  partnerAppId: string,
  pageSize = 100
): Promise<GetShopsByPartnerResponse['authed_shop_list']> {
  const allShops: GetShopsByPartnerResponse['authed_shop_list'] = [];
  let pageNo = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await getShopsByPartner(partnerAppId, pageSize, pageNo);
    allShops.push(...result.authed_shop_list);
    hasMore = result.more;
    pageNo++;
  }

  return allShops;
}

/**
 * Lấy thông tin shop từ Shopee API
 * GET /api/v2/shop/get_shop_info
 * @param shopId - Shop ID cần lấy thông tin
 */
export async function getShopInfo(shopId: number): Promise<GetShopInfoResponse> {
  const { data, error } = await supabase.functions.invoke('apishopee-proxy', {
    body: {
      api_path: '/api/v2/shop/get_shop_info',
      method: 'GET',
      shop_id: shopId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get shop info');
  }

  const responseData = data?.response?.data;

  if (responseData?.error) {
    throw new Error(responseData.message || responseData.error);
  }

  return responseData as GetShopInfoResponse;
}

/**
 * Lấy danh sách merchant đã ủy quyền cho partner app
 * Gọi Shopee API: GET /api/v2/public/get_merchants_by_partner
 * @param partnerAppId - UUID từ bảng apishopee_partner_apps
 * @param pageSize - Số merchant trên mỗi trang (mặc định 100)
 * @param pageNo - Số trang (bắt đầu từ 1)
 */
export async function getMerchantsByPartner(
  partnerAppId: string,
  pageSize = 100,
  pageNo = 1
): Promise<GetMerchantsByPartnerResponse> {
  const { data, error } = await supabase.functions.invoke('apishopee-proxy', {
    body: {
      api_path: '/api/v2/public/get_merchants_by_partner',
      method: 'GET',
      partner_app_id: partnerAppId,
      params: {
        page_size: pageSize,
        page_no: pageNo,
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get merchants by partner');
  }

  const responseData = data?.response?.data;

  if (responseData?.error) {
    throw new Error(responseData.message || responseData.error);
  }

  return responseData as GetMerchantsByPartnerResponse;
}

/**
 * Lấy TẤT CẢ merchant đã ủy quyền cho partner app (tự động phân trang)
 * @param partnerAppId - UUID từ bảng apishopee_partner_apps
 * @param pageSize - Số merchant trên mỗi trang (mặc định 100)
 */
export async function getAllMerchantsByPartner(
  partnerAppId: string,
  pageSize = 100
): Promise<GetMerchantsByPartnerResponse['authed_merchant_list']> {
  const allMerchants: GetMerchantsByPartnerResponse['authed_merchant_list'] = [];
  let pageNo = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await getMerchantsByPartner(partnerAppId, pageSize, pageNo);
    allMerchants.push(...result.authed_merchant_list);
    hasMore = result.more;
    pageNo++;
  }

  return allMerchants;
}

/**
 * Khôi phục token bằng resend code
 * Dùng khi access_token và refresh_token bị mất hoặc hết hạn hoàn toàn
 * @param resendCode - Code lấy từ trang quản lý ủy quyền Shopee
 * @param partnerInfo - Partner credentials (optional, fallback to env)
 */
export async function recoverTokenByResendCode(
  resendCode: string,
  partnerInfo?: PartnerInfo
): Promise<AccessToken> {
  const { data, error } = await supabase.functions.invoke('apishopee-auth', {
    body: {
      action: 'get-token-by-resend-code',
      resend_code: resendCode,
      partner_info: partnerInfo,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to recover token by resend code');
  }

  if (data.error) {
    throw new Error(data.message || data.error);
  }

  return data as AccessToken;
}
