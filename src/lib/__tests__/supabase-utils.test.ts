/**
 * Tests for utility functions exported from src/lib/supabase.ts
 */

import { vi } from 'vitest';

// vi.mock is hoisted — the factory must not reference outer variables.
// We build the mock client inline and expose it via a module-level getter so
// that test cases can still configure per-call return values.
vi.mock('@supabase/supabase-js', () => {
  const authMock = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  };

  // Minimal chainable query builder
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'eq', 'single', 'insert', 'update', 'delete', 'upsert', 'rpc']) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  qb.single.mockResolvedValue({ data: null, error: null });

  const client = {
    from: vi.fn().mockReturnValue(qb),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: authMock,
    _qb: qb,
  };

  return { createClient: vi.fn(() => client) };
});

// After the mock is registered we can safely import the module under test
import {
  isSupabaseConfigured,
  isJwtExpiredError,
  clearShopUuidCache,
  getShopUuidFromShopId,
  forceRefreshSession,
  supabase,
} from '@/lib/supabase';

// Convenience cast so tests can configure the mock
const mockAuth = supabase.auth as unknown as {
  refreshSession: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
};

// Access the query builder through supabase.from
function qb() {
  // @ts-expect-error accessing internal mock structure
  return supabase.from.mock.results[supabase.from.mock.results.length - 1]?.value as Record<string, ReturnType<typeof vi.fn>>;
}

describe('isSupabaseConfigured', () => {
  it('returns a boolean', () => {
    expect(typeof isSupabaseConfigured()).toBe('boolean');
  });
});

describe('isJwtExpiredError', () => {
  it('returns false for null', () => expect(isJwtExpiredError(null)).toBe(false));
  it('returns false for empty object', () => expect(isJwtExpiredError({})).toBe(false));
  it('returns false for primitive string', () => expect(isJwtExpiredError('JWT expired')).toBe(false));
  it('returns false for undefined', () => expect(isJwtExpiredError(undefined)).toBe(false));

  it('returns true for code PGRST303', () => {
    expect(isJwtExpiredError({ code: 'PGRST303' })).toBe(true);
  });

  it('returns true for message containing "JWT expired"', () => {
    expect(isJwtExpiredError({ message: 'JWT expired at 2024-01-01' })).toBe(true);
  });

  it('returns false for unrelated message', () => {
    expect(isJwtExpiredError({ message: 'other error' })).toBe(false);
  });

  it('returns false for different code', () => {
    expect(isJwtExpiredError({ code: 'PGRST116' })).toBe(false);
  });
});

describe('clearShopUuidCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearShopUuidCache();
  });

  it('clears all entries — next fetch hits DB again', async () => {
    // Populate cache for shopId 999
    (supabase.from('apishopee_shops') as unknown as Record<string, ReturnType<typeof vi.fn>>)
      .single.mockResolvedValueOnce({ data: { id: 'uuid-old' }, error: null });
    await getShopUuidFromShopId(999);

    clearShopUuidCache();

    // Now configure a fresh DB response
    vi.clearAllMocks();
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { id: 'uuid-fresh' }, error: null }),
    });

    const result = await getShopUuidFromShopId(999);
    expect(result).toBe('uuid-fresh');
  });

  it('clears only the specified shopId entry', async () => {
    // Populate shopId 777
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { id: 'uuid-777' }, error: null }),
    });
    await getShopUuidFromShopId(777);

    clearShopUuidCache(777);

    // After clearing 777, DB is called again for 777
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { id: 'uuid-777-new' }, error: null }),
    });
    const result = await getShopUuidFromShopId(777);
    expect(result).toBe('uuid-777-new');
  });
});

describe('getShopUuidFromShopId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearShopUuidCache();
  });

  it('returns UUID from DB on cache miss', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: { id: 'shop-uuid-abc' }, error: null }),
    });

    const result = await getShopUuidFromShopId(12345);
    expect(result).toBe('shop-uuid-abc');
    expect(supabase.from).toHaveBeenCalledWith('apishopee_shops');
  });

  it('returns cached value on second call without hitting DB again', async () => {
    const singleFn = vi.fn().mockResolvedValueOnce({ data: { id: 'cached-uuid' }, error: null });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: singleFn,
    });

    const first = await getShopUuidFromShopId(55555);
    // Second call — mock returns nothing but cache should serve it
    const second = await getShopUuidFromShopId(55555);

    expect(first).toBe('cached-uuid');
    expect(second).toBe('cached-uuid');
    expect(singleFn).toHaveBeenCalledTimes(1);
  });

  it('returns null when DB returns an error', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'not found' } }),
    });

    const result = await getShopUuidFromShopId(99999);
    expect(result).toBeNull();
  });

  it('returns null when DB returns no data', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
    });

    const result = await getShopUuidFromShopId(88888);
    expect(result).toBeNull();
  });
});

describe('forceRefreshSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when session is refreshed successfully', async () => {
    mockAuth.refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'new-token' } },
      error: null,
    });

    expect(await forceRefreshSession()).toBe(true);
  });

  it('returns false when refreshed session is null', async () => {
    mockAuth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    expect(await forceRefreshSession()).toBe(false);
  });

  it('calls signOut and returns false when refresh errors', async () => {
    mockAuth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'refresh failed' },
    });

    expect(await forceRefreshSession()).toBe(false);
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('returns false when refresh throws an exception', async () => {
    mockAuth.refreshSession.mockRejectedValueOnce(new Error('network error'));

    expect(await forceRefreshSession()).toBe(false);
  });
});
