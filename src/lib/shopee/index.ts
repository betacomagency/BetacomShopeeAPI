/**
 * Shopee SDK Module - Browser Safe
 * Export tất cả functions cho browser
 */

// Browser-safe exports (mock/local storage)
export {
  SHOPEE_CONFIG,
  ShopeeRegion,
  isConfigValid,
  getAuthorizationUrl as getLocalAuthUrl,
  getStoredToken,
  storeToken,
  clearToken,
  isTokenValid,
  authenticateWithCode as authenticateLocal,
  refreshToken as refreshTokenLocal,
  handleOAuthCallback,
  isServer,
  isBrowser,
} from './browser-safe';

// Supabase Client (Backend API)
export {
  isSupabaseConfigured,
  getAuthorizationUrl,
  authenticateWithCode,
  refreshToken,
  getStoredTokenFromDB,
} from './supabase-client';

// Token Storage
export {
  createTokenStorage,
  createAutoStorage,
  createSecureStorage,
  setStorageType,
  setStorageOptions,
  getStorageType,
  getStorageOptions,
  LocalStorageTokenStorage,
  MemoryTokenStorage,
  IndexedDBTokenStorage,
  EncryptedStorageTokenStorage,
  SupabaseTokenStorage,
} from './storage';
export type { TokenStorage, StorageType, StorageOptions } from './storage';

// Flash Sale Client - Removed (not used)

// Types
export type {
  AccessToken,
  RefreshedAccessToken,
} from './types';
