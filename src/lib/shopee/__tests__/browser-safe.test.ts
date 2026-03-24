/**
 * Unit Tests: browser-safe Shopee SDK wrapper
 * Covers: isConfigValid, getAuthorizationUrl, isTokenValid, handleOAuthCallback
 */

import { vi } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, so mockStorage is safe to use in the factory
const mockStorage = vi.hoisted(() => ({
  get: vi.fn(),
  store: vi.fn(),
  clear: vi.fn(),
}));

vi.mock('@/lib/shopee/storage/local-storage', () => ({
  LocalStorageTokenStorage: function () {
    return mockStorage;
  },
}));

import {
  isConfigValid,
  getAuthorizationUrl,
  isTokenValid,
  handleOAuthCallback,
  authenticateWithCode,
  refreshToken,
  clearToken,
  SHOPEE_CONFIG,
} from '@/lib/shopee/browser-safe';

// ==================== isConfigValid ====================

describe('isConfigValid', () => {
  const origId = SHOPEE_CONFIG.partner_id;
  const origKey = SHOPEE_CONFIG.partner_key;
  const origCallback = SHOPEE_CONFIG.callback_url;

  afterEach(() => {
    SHOPEE_CONFIG.partner_id = origId;
    SHOPEE_CONFIG.partner_key = origKey;
    SHOPEE_CONFIG.callback_url = origCallback;
  });

  it('returns true when partner_id > 0 and partner_key is non-empty', () => {
    SHOPEE_CONFIG.partner_id = 123456;
    SHOPEE_CONFIG.partner_key = 'test_key_abc';

    expect(isConfigValid()).toBe(true);
  });

  it('returns false when partner_id is 0', () => {
    SHOPEE_CONFIG.partner_id = 0;
    SHOPEE_CONFIG.partner_key = 'test_key_abc';

    expect(isConfigValid()).toBe(false);
  });

  it('returns false when partner_key is empty', () => {
    SHOPEE_CONFIG.partner_id = 123456;
    SHOPEE_CONFIG.partner_key = '';

    expect(isConfigValid()).toBe(false);
  });
});

// ==================== getAuthorizationUrl ====================

describe('getAuthorizationUrl', () => {
  beforeEach(() => {
    SHOPEE_CONFIG.partner_id = 999888;
    SHOPEE_CONFIG.partner_key = 'test_partner_key';
    SHOPEE_CONFIG.callback_url = 'https://example.com/callback';
  });

  it('returns a URL string starting with https://', () => {
    const url = getAuthorizationUrl();
    expect(typeof url).toBe('string');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('includes partner_id in the URL', () => {
    const url = getAuthorizationUrl();
    expect(url).toContain('partner_id=999888');
  });

  it('includes a numeric timestamp parameter', () => {
    const url = getAuthorizationUrl();
    expect(url).toMatch(/timestamp=\d+/);
  });

  it('includes default callback_url as redirect when no custom redirect given', () => {
    const url = getAuthorizationUrl();
    expect(url).toContain(encodeURIComponent('https://example.com/callback'));
  });

  it('uses custom redirect URI when provided', () => {
    const customRedirect = 'https://custom.example.com/auth';
    const url = getAuthorizationUrl(customRedirect);
    expect(url).toContain(encodeURIComponent(customRedirect));
  });

  it('contains the auth_partner API path', () => {
    const url = getAuthorizationUrl();
    expect(url).toContain('/api/v2/shop/auth_partner');
  });
});

// ==================== isTokenValid ====================

describe('isTokenValid', () => {
  beforeEach(() => {
    mockStorage.get.mockReset();
  });

  it('returns false when no token is stored', async () => {
    mockStorage.get.mockResolvedValue(null);
    expect(await isTokenValid()).toBe(false);
  });

  it('returns true when token has no expired_at field', async () => {
    mockStorage.get.mockResolvedValue({
      access_token: 'abc',
      refresh_token: 'def',
      expire_in: 14400,
    });
    expect(await isTokenValid()).toBe(true);
  });

  it('returns false when token is already expired', async () => {
    mockStorage.get.mockResolvedValue({
      access_token: 'abc',
      refresh_token: 'def',
      expire_in: 14400,
      expired_at: Date.now() - 60 * 1000, // 1 minute ago
    });
    expect(await isTokenValid()).toBe(false);
  });

  it('returns false when token expires within buffer window (5 min buffer, expires in 3 min)', async () => {
    mockStorage.get.mockResolvedValue({
      access_token: 'abc',
      refresh_token: 'def',
      expire_in: 14400,
      expired_at: Date.now() + 3 * 60 * 1000,
    });
    expect(await isTokenValid(5)).toBe(false);
  });

  it('returns true when token expires well beyond the buffer window', async () => {
    mockStorage.get.mockResolvedValue({
      access_token: 'abc',
      refresh_token: 'def',
      expire_in: 14400,
      expired_at: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
    });
    expect(await isTokenValid()).toBe(true);
  });
});

// ==================== handleOAuthCallback ====================

describe('handleOAuthCallback', () => {
  beforeEach(() => {
    mockStorage.store.mockReset();
    mockStorage.store.mockResolvedValue(undefined);
    mockStorage.get.mockReset();
    mockStorage.get.mockResolvedValue(null);
  });

  it('throws when authorization code is missing', async () => {
    const params = new URLSearchParams({ shop_id: '12345' });
    await expect(handleOAuthCallback(params)).rejects.toThrow(
      'Missing authorization code in callback'
    );
  });

  it('throws when params are completely empty', async () => {
    const params = new URLSearchParams();
    await expect(handleOAuthCallback(params)).rejects.toThrow();
  });

  it('returns a token object with access_token and refresh_token when code is present', async () => {
    const params = new URLSearchParams({ code: 'auth_code_abc', shop_id: '99999' });
    const token = await handleOAuthCallback(params);
    expect(token.access_token).toBeTruthy();
    expect(token.refresh_token).toBeTruthy();
  });

  it('returns token with correct numeric shop_id when shop_id param provided', async () => {
    const params = new URLSearchParams({ code: 'auth_code_xyz', shop_id: '77777' });
    const token = await handleOAuthCallback(params);
    expect(token.shop_id).toBe(77777);
  });

  it('returns token without shop_id when shop_id param is absent', async () => {
    const params = new URLSearchParams({ code: 'auth_code_only' });
    const token = await handleOAuthCallback(params);
    expect(token.shop_id).toBeUndefined();
  });

  it('calls store with the returned token', async () => {
    const params = new URLSearchParams({ code: 'store_test_code', shop_id: '55555' });
    await handleOAuthCallback(params);
    expect(mockStorage.store).toHaveBeenCalledTimes(1);
    const storedToken = mockStorage.store.mock.calls[0][0];
    expect(storedToken.access_token).toBeTruthy();
  });
});

// ==================== authenticateWithCode ====================

describe('authenticateWithCode', () => {
  beforeEach(() => {
    mockStorage.store.mockReset();
    mockStorage.store.mockResolvedValue(undefined);
  });

  it('returns a mock token with access_token and refresh_token', async () => {
    const token = await authenticateWithCode('test-code', 12345);
    expect(token.access_token).toContain('mock_access_token_');
    expect(token.refresh_token).toContain('mock_refresh_token_');
    expect(token.shop_id).toBe(12345);
  });

  it('stores the token via tokenStorage', async () => {
    await authenticateWithCode('code', 1);
    expect(mockStorage.store).toHaveBeenCalledTimes(1);
  });

  it('works without shopId', async () => {
    const token = await authenticateWithCode('code');
    expect(token.access_token).toBeTruthy();
    expect(token.shop_id).toBeUndefined();
  });
});

// ==================== refreshToken ====================

describe('refreshToken', () => {
  beforeEach(() => {
    mockStorage.store.mockReset();
    mockStorage.store.mockResolvedValue(undefined);
    mockStorage.get.mockReset();
  });

  it('returns a refreshed mock token', async () => {
    mockStorage.get.mockResolvedValue({
      access_token: 'old',
      refresh_token: 'old_refresh',
      expire_in: 14400,
    });

    const token = await refreshToken(99, 88);
    expect(token.access_token).toContain('mock_refreshed_token_');
    expect(token.shop_id).toBe(99);
    expect(token.merchant_id).toBe(88);
  });

  it('preserves existing refresh_token from stored token', async () => {
    mockStorage.get.mockResolvedValue({
      access_token: 'old',
      refresh_token: 'keep_this_refresh',
      expire_in: 14400,
    });

    const token = await refreshToken();
    expect(token.refresh_token).toBe('keep_this_refresh');
  });

  it('uses fallback refresh_token when no stored token', async () => {
    mockStorage.get.mockResolvedValue(null);

    const token = await refreshToken();
    expect(token.refresh_token).toContain('mock_refresh_');
  });

  it('stores the new token', async () => {
    mockStorage.get.mockResolvedValue(null);

    await refreshToken();
    expect(mockStorage.store).toHaveBeenCalledTimes(1);
  });
});

// ==================== clearToken ====================

describe('clearToken', () => {
  it('calls tokenStorage.clear', async () => {
    mockStorage.clear.mockReset();
    mockStorage.clear.mockResolvedValue(undefined);

    await clearToken();
    expect(mockStorage.clear).toHaveBeenCalledTimes(1);
  });
});
