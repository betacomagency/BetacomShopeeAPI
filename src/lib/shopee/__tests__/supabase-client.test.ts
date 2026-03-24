/**
 * Tests for Shopee API Client (supabase-client.ts)
 * Covers functions that invoke Supabase edge functions.
 */

import { vi } from 'vitest';

const mockInvoke = vi.hoisted(() => vi.fn());
const mockRefreshSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { refreshSession: mockRefreshSession },
    functions: { invoke: mockInvoke },
  },
  isSupabaseConfigured: true,
}));

import {
  authenticateWithCode,
  refreshToken,
  getStoredTokenFromDB,
  getShopsByPartner,
  getAllShopsByPartner,
  getShopInfo,
  getMerchantsByPartner,
  getAllMerchantsByPartner,
  recoverTokenByResendCode,
  getAuthorizationUrl,
} from '../supabase-client';

describe('supabase-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // refreshSession is called inside authenticateWithCode
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  // ── authenticateWithCode ─────────────────────────────────────────────────

  describe('authenticateWithCode', () => {
    it('returns AccessToken on success', async () => {
      const tokenData = {
        access_token: 'acc',
        refresh_token: 'ref',
        expire_in: 14400,
        shop_id: 100001,
      };
      mockInvoke.mockResolvedValueOnce({ data: tokenData, error: null });

      const result = await authenticateWithCode('auth-code', 100001);

      expect(result.access_token).toBe('acc');
      expect(result.shop_id).toBe(100001);
    });

    it('uses shopId fallback when data.shop_id is absent', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { access_token: 'acc', refresh_token: 'ref', expire_in: 14400 },
        error: null,
      });

      const result = await authenticateWithCode('code', 555);

      expect(result.shop_id).toBe(555);
    });

    it('throws when invoke returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'invoke error' },
      });

      await expect(authenticateWithCode('code')).rejects.toThrow('invoke error');
    });

    it('throws when data.error is set', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'bad_code', message: 'Invalid code' },
        error: null,
      });

      await expect(authenticateWithCode('code')).rejects.toThrow('Invalid code');
    });

    it('invokes get-token action by default', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { access_token: 'a', refresh_token: 'r', expire_in: 1 },
        error: null,
      });

      await authenticateWithCode('mycode', 1);

      expect(mockInvoke).toHaveBeenCalledWith(
        'apishopee-auth',
        expect.objectContaining({ body: expect.objectContaining({ action: 'get-token' }) })
      );
    });

    it('invokes get-app-token when partner_app_id provided', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { access_token: 'a', refresh_token: 'r', expire_in: 1 },
        error: null,
      });

      const partnerInfo = { partner_id: 1, partner_key: 'k', partner_app_id: 'app-uuid' } as never;
      await authenticateWithCode('mycode', 1, undefined, partnerInfo);

      expect(mockInvoke).toHaveBeenCalledWith(
        'apishopee-auth',
        expect.objectContaining({ body: expect.objectContaining({ action: 'get-app-token' }) })
      );
    });
  });

  // ── refreshToken ─────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns AccessToken on success', async () => {
      const tokenData = { access_token: 'new', refresh_token: 'ref2', expire_in: 14400 };
      mockInvoke.mockResolvedValueOnce({ data: tokenData, error: null });

      const result = await refreshToken('old-refresh', 100001);

      expect(result.access_token).toBe('new');
    });

    it('invokes with correct body', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { access_token: 'a', refresh_token: 'r', expire_in: 1 },
        error: null,
      });

      await refreshToken('rt', 42, undefined, undefined, undefined);

      expect(mockInvoke).toHaveBeenCalledWith('apishopee-auth', {
        body: {
          action: 'refresh-token',
          refresh_token: 'rt',
          shop_id: 42,
          merchant_id: undefined,
          supplier_id: undefined,
          user_id: undefined,
        },
      });
    });

    it('throws when invoke returns error', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

      await expect(refreshToken('rt')).rejects.toThrow('fail');
    });

    it('throws when data.error is set', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'expired', message: 'Token expired' },
        error: null,
      });

      await expect(refreshToken('rt')).rejects.toThrow('Token expired');
    });
  });

  // ── getStoredTokenFromDB ─────────────────────────────────────────────────

  describe('getStoredTokenFromDB', () => {
    it('returns AccessToken when found', async () => {
      const tokenData = { access_token: 'stored', refresh_token: 'ref', expire_in: 14400, shop_id: 1 };
      mockInvoke.mockResolvedValueOnce({ data: tokenData, error: null });

      const result = await getStoredTokenFromDB(1);

      expect(result?.access_token).toBe('stored');
    });

    it('returns null on invoke error', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

      const result = await getStoredTokenFromDB(1);

      expect(result).toBeNull();
    });

    it('returns null when data.error is set', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'not_found' },
        error: null,
      });

      const result = await getStoredTokenFromDB(1);

      expect(result).toBeNull();
    });
  });

  // ── getShopsByPartner ─────────────────────────────────────────────────────

  describe('getShopsByPartner', () => {
    it('returns shop list on success', async () => {
      const shopList = { authed_shop_list: [{ shop_id: 1 }], more: false, request_id: 'r1' };
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: shopList } },
        error: null,
      });

      const result = await getShopsByPartner('app-uuid');

      expect(result.authed_shop_list).toHaveLength(1);
    });

    it('calls apishopee-proxy with correct body', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { authed_shop_list: [], more: false, request_id: 'r' } } },
        error: null,
      });

      await getShopsByPartner('app-uuid', 50, 2);

      expect(mockInvoke).toHaveBeenCalledWith('apishopee-proxy', {
        body: {
          api_path: '/api/v2/public/get_shops_by_partner',
          method: 'GET',
          partner_app_id: 'app-uuid',
          params: { page_size: 50, page_no: 2 },
        },
      });
    });

    it('throws on invoke error', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'proxy fail' } });

      await expect(getShopsByPartner('uuid')).rejects.toThrow('proxy fail');
    });

    it('throws when responseData.error is set', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { error: 'partner_err', message: 'Partner error' } } },
        error: null,
      });

      await expect(getShopsByPartner('uuid')).rejects.toThrow('Partner error');
    });
  });

  // ── getShopInfo ───────────────────────────────────────────────────────────

  describe('getShopInfo', () => {
    it('returns shop info on success', async () => {
      const info = { shop_name: 'My Shop', region: 'VN', error: '', message: '', request_id: 'r' };
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: info } },
        error: null,
      });

      const result = await getShopInfo(100001);

      expect(result.shop_name).toBe('My Shop');
    });

    it('throws on invoke error', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'network' } });

      await expect(getShopInfo(1)).rejects.toThrow('network');
    });

    it('throws when responseData.error is set', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { error: 'shop_not_found', message: 'Shop not found' } } },
        error: null,
      });

      await expect(getShopInfo(1)).rejects.toThrow('Shop not found');
    });
  });

  // ── getMerchantsByPartner ─────────────────────────────────────────────────

  describe('getMerchantsByPartner', () => {
    it('returns merchant list on success', async () => {
      const data = { authed_merchant_list: [{ merchant_id: 9 }], more: false, request_id: 'm1' };
      mockInvoke.mockResolvedValueOnce({ data: { response: { data } }, error: null });

      const result = await getMerchantsByPartner('app-uuid');

      expect(result.authed_merchant_list).toHaveLength(1);
    });

    it('throws on responseData error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { error: 'err', message: 'Bad request' } } },
        error: null,
      });

      await expect(getMerchantsByPartner('uuid')).rejects.toThrow('Bad request');
    });

    it('throws on invoke error', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'merchant proxy fail' } });

      await expect(getMerchantsByPartner('uuid')).rejects.toThrow('merchant proxy fail');
    });
  });

  // ── recoverTokenByResendCode ──────────────────────────────────────────────

  describe('recoverTokenByResendCode', () => {
    it('returns AccessToken on success', async () => {
      const tokenData = { access_token: 'rec', refresh_token: 'ref', expire_in: 14400 };
      mockInvoke.mockResolvedValueOnce({ data: tokenData, error: null });

      const result = await recoverTokenByResendCode('resend-code');

      expect(result.access_token).toBe('rec');
    });

    it('throws on invoke error', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

      await expect(recoverTokenByResendCode('code')).rejects.toThrow('fail');
    });

    it('throws when data.error is set', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'invalid', message: 'Invalid resend code' },
        error: null,
      });

      await expect(recoverTokenByResendCode('code')).rejects.toThrow('Invalid resend code');
    });
  });

  // ── getAuthorizationUrl ─────────────────────────────────────────────────

  describe('getAuthorizationUrl', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    it('returns auth_url on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ auth_url: 'https://shopee.com/auth?partner_id=123' }),
      });

      const result = await getAuthorizationUrl('https://callback.test');

      expect(result).toBe('https://shopee.com/auth?partner_id=123');
    });

    it('throws when response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(getAuthorizationUrl('https://callback.test')).rejects.toThrow('HTTP 500');
    });

    it('throws when response has error field', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'invalid_partner', message: 'Invalid partner' }),
      });

      await expect(getAuthorizationUrl('https://callback.test')).rejects.toThrow('Invalid partner');
    });

    it('throws when auth_url is missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'No URL' }),
      });

      await expect(getAuthorizationUrl('https://callback.test')).rejects.toThrow('No URL');
    });
  });

  // ── getAllShopsByPartner ────────────────────────────────────────────────

  describe('getAllShopsByPartner', () => {
    it('collects shops across multiple pages', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          data: { response: { data: { authed_shop_list: [{ shop_id: 1 }], more: true, request_id: 'r1' } } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { response: { data: { authed_shop_list: [{ shop_id: 2 }], more: false, request_id: 'r2' } } },
          error: null,
        });

      const result = await getAllShopsByPartner('app-uuid', 1);

      expect(result).toHaveLength(2);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('stops when authed_shop_list is empty', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { authed_shop_list: [], more: true, request_id: 'r' } } },
        error: null,
      });

      const result = await getAllShopsByPartner('app-uuid');

      expect(result).toHaveLength(0);
    });
  });

  // ── getAllMerchantsByPartner ────────────────────────────────────────────

  describe('getAllMerchantsByPartner', () => {
    it('collects merchants across multiple pages', async () => {
      mockInvoke
        .mockResolvedValueOnce({
          data: { response: { data: { authed_merchant_list: [{ merchant_id: 1 }], more: true, request_id: 'r1' } } },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { response: { data: { authed_merchant_list: [{ merchant_id: 2 }], more: false, request_id: 'r2' } } },
          error: null,
        });

      const result = await getAllMerchantsByPartner('app-uuid', 1);

      expect(result).toHaveLength(2);
    });

    it('stops when authed_merchant_list is empty', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { authed_merchant_list: [], more: true, request_id: 'r' } } },
        error: null,
      });

      const result = await getAllMerchantsByPartner('app-uuid');

      expect(result).toHaveLength(0);
    });
  });
});
