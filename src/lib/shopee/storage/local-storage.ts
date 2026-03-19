/**
 * LocalStorage Token Storage
 * Lưu token vào localStorage (cho browser)
 */

import type { TokenStorage } from './token-storage.interface';
import type { AccessToken } from '../types';

const STORAGE_KEY_PREFIX = 'shopee_token';

export class LocalStorageTokenStorage implements TokenStorage {
  private key: string;

  constructor(shopId?: number) {
    this.key = shopId 
      ? `${STORAGE_KEY_PREFIX}_${shopId}` 
      : `${STORAGE_KEY_PREFIX}_default`;
  }

  async store(token: AccessToken): Promise<void> {
    try {
      const data = JSON.stringify(token);
      localStorage.setItem(this.key, data);
      
      // Cũng lưu vào default key nếu là token đầu tiên
      const defaultKey = `${STORAGE_KEY_PREFIX}_default`;
      if (!localStorage.getItem(defaultKey)) {
        localStorage.setItem(defaultKey, data);
      }
    } catch (error) {
      console.error('[TokenStorage] Failed to store token:', error);
      throw error;
    }
  }

  async get(): Promise<AccessToken | null> {
    try {
      const data = localStorage.getItem(this.key);

      if (!data) {
        // Fallback to default key
        const defaultData = localStorage.getItem(`${STORAGE_KEY_PREFIX}_default`);
        if (!defaultData) return null;
        return this.parseAndValidate(defaultData);
      }

      return this.parseAndValidate(data);
    } catch (error) {
      console.error('[TokenStorage] Failed to get token:', error);
      return null;
    }
  }

  /** Parse JSON and validate it has required token fields */
  private parseAndValidate(raw: string): AccessToken | null {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.access_token) {
      console.warn('[TokenStorage] Invalid token data in storage, clearing');
      localStorage.removeItem(this.key);
      return null;
    }
    return parsed as AccessToken;
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error('[TokenStorage] Failed to clear token:', error);
    }
  }

  /**
   * Xóa tất cả tokens
   */
  static clearAll(): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Lấy tất cả shop IDs đã lưu token
   */
  static getAllShopIds(): number[] {
    const shopIds: number[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX) && key !== `${STORAGE_KEY_PREFIX}_default`) {
        const shopId = parseInt(key.replace(`${STORAGE_KEY_PREFIX}_`, ''), 10);
        if (!isNaN(shopId)) {
          shopIds.push(shopId);
        }
      }
    }
    
    return shopIds;
  }
}
