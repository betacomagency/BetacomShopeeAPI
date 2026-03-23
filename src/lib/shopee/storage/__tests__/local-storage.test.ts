/**
 * Tests for LocalStorageTokenStorage
 */

import { LocalStorageTokenStorage } from '../local-storage';
import { createMockAccessToken } from '@/test/factories';

// jsdom provides localStorage — reset between tests with a helper
function clearStorage() {
  localStorage.clear();
}

describe('LocalStorageTokenStorage', () => {
  beforeEach(() => {
    clearStorage();
    vi.restoreAllMocks();
  });

  describe('store', () => {
    it('writes token JSON to localStorage', async () => {
      const storage = new LocalStorageTokenStorage(100001);
      const token = createMockAccessToken({ shop_id: 100001 });

      await storage.store(token);

      const raw = localStorage.getItem('shopee_token_100001');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual(token);
    });

    it('also writes to default key when default slot is empty', async () => {
      const storage = new LocalStorageTokenStorage(100001);
      const token = createMockAccessToken();

      await storage.store(token);

      const raw = localStorage.getItem('shopee_token_default');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual(token);
    });

    it('does not overwrite existing default key', async () => {
      const first = createMockAccessToken({ access_token: 'first' });
      const second = createMockAccessToken({ access_token: 'second' });

      await new LocalStorageTokenStorage(1).store(first);
      await new LocalStorageTokenStorage(2).store(second);

      const raw = localStorage.getItem('shopee_token_default');
      expect(JSON.parse(raw!).access_token).toBe('first');
    });

    it('throws when localStorage.setItem throws', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      const storage = new LocalStorageTokenStorage(1);

      await expect(storage.store(createMockAccessToken())).rejects.toThrow();
    });
  });

  describe('get', () => {
    it('returns stored token by shop key', async () => {
      const storage = new LocalStorageTokenStorage(100001);
      const token = createMockAccessToken({ shop_id: 100001 });
      await storage.store(token);

      const result = await storage.get();

      expect(result).toEqual(token);
    });

    it('returns null when nothing stored', async () => {
      const storage = new LocalStorageTokenStorage(99999);

      const result = await storage.get();

      expect(result).toBeNull();
    });

    it('falls back to default key when shop key missing', async () => {
      const token = createMockAccessToken({ shop_id: 1 });
      localStorage.setItem('shopee_token_default', JSON.stringify(token));

      const storage = new LocalStorageTokenStorage(999);
      const result = await storage.get();

      expect(result).toEqual(token);
    });

    it('returns null when both shop key and default are absent', async () => {
      const storage = new LocalStorageTokenStorage(42);

      expect(await storage.get()).toBeNull();
    });

    it('handles corrupted JSON gracefully — returns null', async () => {
      localStorage.setItem('shopee_token_100001', 'not-valid-json{{{');
      const storage = new LocalStorageTokenStorage(100001);

      const result = await storage.get();

      expect(result).toBeNull();
    });

    it('returns null when stored object has no access_token field', async () => {
      localStorage.setItem('shopee_token_100001', JSON.stringify({ foo: 'bar' }));
      const storage = new LocalStorageTokenStorage(100001);

      const result = await storage.get();

      expect(result).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes the shop-specific key', async () => {
      const storage = new LocalStorageTokenStorage(100001);
      await storage.store(createMockAccessToken());

      await storage.clear();

      expect(localStorage.getItem('shopee_token_100001')).toBeNull();
    });

    it('does not remove default key', async () => {
      const storage = new LocalStorageTokenStorage(100001);
      await storage.store(createMockAccessToken());
      const defaultRaw = localStorage.getItem('shopee_token_default');

      await storage.clear();

      expect(localStorage.getItem('shopee_token_default')).toBe(defaultRaw);
    });
  });

  describe('getAllShopIds (static)', () => {
    it('returns shop IDs for all stored tokens', async () => {
      await new LocalStorageTokenStorage(111).store(createMockAccessToken({ shop_id: 111 }));
      await new LocalStorageTokenStorage(222).store(createMockAccessToken({ shop_id: 222 }));

      const ids = LocalStorageTokenStorage.getAllShopIds();

      expect(ids).toContain(111);
      expect(ids).toContain(222);
    });

    it('excludes the default key from results', async () => {
      await new LocalStorageTokenStorage(111).store(createMockAccessToken());

      const ids = LocalStorageTokenStorage.getAllShopIds();

      expect(ids).not.toContain(NaN);
      // default key should not produce a numeric entry
      ids.forEach(id => expect(Number.isNaN(id)).toBe(false));
    });

    it('returns empty array when nothing stored', () => {
      expect(LocalStorageTokenStorage.getAllShopIds()).toEqual([]);
    });
  });

  describe('clearAll (static)', () => {
    it('removes all shopee_token_* keys', async () => {
      await new LocalStorageTokenStorage(1).store(createMockAccessToken());
      await new LocalStorageTokenStorage(2).store(createMockAccessToken());
      localStorage.setItem('other_key', 'should-survive');

      LocalStorageTokenStorage.clearAll();

      expect(localStorage.getItem('shopee_token_1')).toBeNull();
      expect(localStorage.getItem('shopee_token_2')).toBeNull();
      expect(localStorage.getItem('shopee_token_default')).toBeNull();
      expect(localStorage.getItem('other_key')).toBe('should-survive');
    });

    it('is safe to call when nothing stored', () => {
      expect(() => LocalStorageTokenStorage.clearAll()).not.toThrow();
    });
  });

  describe('default constructor (no shopId)', () => {
    it('uses default key and stores/retrieves correctly', async () => {
      const storage = new LocalStorageTokenStorage();
      const token = createMockAccessToken();

      await storage.store(token);
      const result = await storage.get();

      expect(result).toEqual(token);
    });
  });
});
