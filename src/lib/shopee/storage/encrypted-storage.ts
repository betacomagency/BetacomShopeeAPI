/**
 * Encrypted LocalStorage Token Storage
 * Mã hóa token trước khi lưu vào localStorage (cho browser production)
 * Sử dụng Web Crypto API (AES-GCM) — không cần thư viện ngoài
 */

import type { TokenStorage } from './token-storage.interface';
import type { AccessToken } from '../types';

const STORAGE_KEY_PREFIX = 'shopee_token_enc';
const SALT = 'shopee-sdk-salt-v1';

export class EncryptedStorageTokenStorage implements TokenStorage {
  private key: string;
  private encryptionKey: string;

  /**
   * @param shopId - Shop ID (optional)
   * @param encryptionKey - Key để mã hóa. Nên dùng env variable VITE_TOKEN_ENCRYPTION_KEY
   */
  constructor(shopId?: number, encryptionKey?: string) {
    this.key = shopId
      ? `${STORAGE_KEY_PREFIX}_${shopId}`
      : `${STORAGE_KEY_PREFIX}_default`;
    this.encryptionKey = encryptionKey
      || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_TOKEN_ENCRYPTION_KEY : '')
      || 'default-encryption-key-change-me';
  }

  /**
   * Derive CryptoKey từ password string sử dụng PBKDF2
   */
  private async deriveKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(SALT),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Mã hóa plaintext bằng AES-GCM
   */
  private async encrypt(plaintext: string): Promise<string> {
    const cryptoKey = await this.deriveKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV cho AES-GCM

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(plaintext)
    );

    // Combine IV + encrypted data → base64
    const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Giải mã ciphertext bằng AES-GCM
   */
  private async decrypt(ciphertext: string): Promise<string> {
    const cryptoKey = await this.deriveKey();
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

    // Tách IV (12 bytes đầu) và encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  async store(token: AccessToken): Promise<void> {
    try {
      const json = JSON.stringify(token);
      const encrypted = await this.encrypt(json);
      localStorage.setItem(this.key, encrypted);

      // Lưu vào default key nếu là token đầu tiên
      const defaultKey = `${STORAGE_KEY_PREFIX}_default`;
      if (!localStorage.getItem(defaultKey)) {
        localStorage.setItem(defaultKey, encrypted);
      }
    } catch (error) {
      console.error('[EncryptedStorage] Failed to store token:', error);
      throw error;
    }
  }

  async get(): Promise<AccessToken | null> {
    try {
      let data = localStorage.getItem(this.key);

      if (!data) {
        // Fallback to default key
        data = localStorage.getItem(`${STORAGE_KEY_PREFIX}_default`);
        if (!data) return null;
      }

      const json = await this.decrypt(data);
      return JSON.parse(json) as AccessToken;
    } catch (error) {
      console.error('[EncryptedStorage] Failed to get token:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error('[EncryptedStorage] Failed to clear token:', error);
    }
  }

  /**
   * Xóa tất cả encrypted tokens
   */
  static clearAll(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}
