/**
 * Supabase Token Storage
 * Lưu token vào Supabase database, bảo vệ bởi RLS
 * Phù hợp cho multi-device sync và production apps
 */

import type { TokenStorage } from './token-storage.interface';
import type { AccessToken } from '../types';
import { supabase, isSupabaseConfigured } from '../../supabase';

export class SupabaseTokenStorage implements TokenStorage {
  private shopId: number | undefined;
  private userId: string | undefined;

  /**
   * @param shopId - Shop ID
   * @param userId - User UUID từ Supabase Auth (dùng cho RLS)
   */
  constructor(shopId?: number, userId?: string) {
    this.shopId = shopId;
    this.userId = userId;
  }

  async store(token: AccessToken): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.warn('[SupabaseStorage] Supabase not configured, skipping store');
      return;
    }

    const shopId = token.shop_id || this.shopId;
    if (!shopId) {
      console.error('[SupabaseStorage] No shop_id to store token for');
      return;
    }

    try {
      const now = Date.now();
      const accessTokenExpiredAt = now + (token.expire_in || 14400) * 1000;

      const tokenData: Record<string, unknown> = {
        shop_id: shopId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expire_in: token.expire_in,
        expired_at: accessTokenExpiredAt,
        access_token_expired_at: accessTokenExpiredAt,
        token_updated_at: new Date().toISOString(),
      };

      if (token.merchant_id) {
        tokenData.merchant_id = token.merchant_id;
      }

      const { error } = await supabase
        .from('apishopee_shops')
        .upsert(tokenData, { onConflict: 'shop_id' });

      if (error) {
        console.error('[SupabaseStorage] Failed to store token:', error);
        throw error;
      }

      console.log('[SupabaseStorage] Token stored for shop:', shopId);
    } catch (error) {
      console.error('[SupabaseStorage] Store error:', error);
      throw error;
    }
  }

  async get(): Promise<AccessToken | null> {
    if (!isSupabaseConfigured()) {
      console.warn('[SupabaseStorage] Supabase not configured, returning null');
      return null;
    }

    const shopId = this.shopId;
    if (!shopId) {
      console.warn('[SupabaseStorage] No shop_id specified, cannot get token');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('apishopee_shops')
        .select('access_token, refresh_token, expire_in, expired_at, shop_id, merchant_id')
        .eq('shop_id', shopId)
        .single();

      if (error || !data) {
        if (error?.code !== 'PGRST116') { // Not "no rows" error
          console.error('[SupabaseStorage] Failed to get token:', error);
        }
        return null;
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expire_in: data.expire_in,
        expired_at: data.expired_at,
        shop_id: data.shop_id,
        merchant_id: data.merchant_id,
      } as AccessToken;
    } catch (error) {
      console.error('[SupabaseStorage] Get error:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    const shopId = this.shopId;
    if (!shopId) {
      return;
    }

    try {
      // Xóa token fields, không xóa shop record
      const { error } = await supabase
        .from('apishopee_shops')
        .update({
          access_token: null,
          refresh_token: null,
          expired_at: null,
          access_token_expired_at: null,
          token_updated_at: new Date().toISOString(),
        })
        .eq('shop_id', shopId);

      if (error) {
        console.error('[SupabaseStorage] Failed to clear token:', error);
      }
    } catch (error) {
      console.error('[SupabaseStorage] Clear error:', error);
    }
  }
}
