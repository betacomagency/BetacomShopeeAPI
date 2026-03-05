/**
 * Token Storage Module
 * Export tất cả storage implementations và factory functions
 */

export type { TokenStorage } from './token-storage.interface';
export { LocalStorageTokenStorage } from './local-storage';
export { MemoryTokenStorage } from './memory-storage';
export { IndexedDBTokenStorage } from './indexed-db-storage';
export { EncryptedStorageTokenStorage } from './encrypted-storage';
export { SupabaseTokenStorage } from './supabase-storage';

// Factory function imports
import { LocalStorageTokenStorage } from './local-storage';
import { MemoryTokenStorage } from './memory-storage';
import { IndexedDBTokenStorage } from './indexed-db-storage';
import { EncryptedStorageTokenStorage } from './encrypted-storage';
import { SupabaseTokenStorage } from './supabase-storage';
import type { TokenStorage } from './token-storage.interface';
import { isSupabaseConfigured } from '../../supabase';

// ==================== Types ====================

export type StorageType = 'localStorage' | 'encrypted' | 'indexedDB' | 'memory' | 'supabase';

export interface StorageOptions {
  shopId?: number;
  userId?: string;
  encryptionKey?: string;
}

// ==================== Global Config ====================

let globalStorageType: StorageType = 'localStorage';
let globalStorageOptions: StorageOptions = {};

/**
 * Set storage type globally
 * Tất cả createTokenStorage() sau này sẽ dùng type này
 * @param type - Loại storage
 * @param options - Options bổ sung (userId, encryptionKey, ...)
 */
export function setStorageType(type: StorageType, options?: StorageOptions): void {
  globalStorageType = type;
  if (options) {
    globalStorageOptions = { ...globalStorageOptions, ...options };
  }
  console.log(`[TokenStorage] Global storage type set to: ${type}`);
}

/**
 * Update global storage options (không đổi type)
 * @param options - Options bổ sung
 */
export function setStorageOptions(options: StorageOptions): void {
  globalStorageOptions = { ...globalStorageOptions, ...options };
}

/**
 * Lấy storage type hiện tại
 */
export function getStorageType(): StorageType {
  return globalStorageType;
}

/**
 * Lấy storage options hiện tại
 */
export function getStorageOptions(): StorageOptions {
  return { ...globalStorageOptions };
}

// ==================== Factory Functions ====================

/**
 * Tạo token storage instance
 * @param type - Loại storage (nếu không truyền, dùng global type)
 * @param options - Options (nếu không truyền, dùng global options)
 */
export function createTokenStorage(
  type?: StorageType,
  options?: StorageOptions | number
): TokenStorage {
  // Backward compatible: nếu options là number thì đó là shopId
  const opts: StorageOptions = typeof options === 'number'
    ? { ...globalStorageOptions, shopId: options }
    : { ...globalStorageOptions, ...options };

  const storageType = type || globalStorageType;

  switch (storageType) {
    case 'encrypted':
      return new EncryptedStorageTokenStorage(opts.shopId, opts.encryptionKey);
    case 'indexedDB':
      return new IndexedDBTokenStorage(opts.shopId);
    case 'memory':
      return new MemoryTokenStorage(opts.shopId);
    case 'supabase':
      return new SupabaseTokenStorage(opts.shopId, opts.userId);
    case 'localStorage':
    default:
      return new LocalStorageTokenStorage(opts.shopId);
  }
}

/**
 * Tự động chọn storage phù hợp với môi trường
 * - Server: memory
 * - Browser: localStorage (fallback memory)
 */
export function createAutoStorage(shopId?: number): TokenStorage {
  // Kiểm tra môi trường
  if (typeof window === 'undefined') {
    // Server-side: dùng memory
    return new MemoryTokenStorage(shopId);
  }

  // Browser: ưu tiên localStorage, fallback to memory
  try {
    localStorage.setItem('__test__', 'test');
    localStorage.removeItem('__test__');
    return new LocalStorageTokenStorage(shopId);
  } catch {
    console.warn('[TokenStorage] localStorage not available, using memory storage');
    return new MemoryTokenStorage(shopId);
  }
}

/**
 * Tạo storage an toàn nhất có thể
 * - Nếu có userId + Supabase configured → Supabase storage
 * - Nếu có encryptionKey → Encrypted localStorage
 * - Fallback → Encrypted với default key
 * 
 * @param options - Cần ít nhất shopId
 */
export function createSecureStorage(options: StorageOptions): TokenStorage {
  const { shopId, userId, encryptionKey } = options;

  // Ưu tiên 1: Supabase storage (nếu có userId và Supabase configured)
  if (userId && isSupabaseConfigured()) {
    console.log('[TokenStorage] Using Supabase secure storage');
    return new SupabaseTokenStorage(shopId, userId);
  }

  // Ưu tiên 2: Encrypted localStorage
  if (typeof window !== 'undefined') {
    console.log('[TokenStorage] Using encrypted localStorage');
    return new EncryptedStorageTokenStorage(shopId, encryptionKey);
  }

  // Fallback: Memory (server-side)
  console.log('[TokenStorage] Using memory storage (server)');
  return new MemoryTokenStorage(shopId);
}
