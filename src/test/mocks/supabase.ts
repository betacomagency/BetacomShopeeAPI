/**
 * Supabase client mock factory
 * Provides chainable mock for all Supabase operations
 */

import { vi } from 'vitest';

/** Creates a chainable query builder mock */
function createQueryBuilder() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'is', 'not', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'single', 'maybeSingle',
    'csv', 'returns',
  ];

  // Each method returns the builder (chainable), resolves to { data: null, error: null }
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods resolve to default response
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  // select/insert/update/delete as terminal also resolve
  builder.select.mockImplementation(() => {
    const chain = { ...builder };
    chain.then = vi.fn((resolve) => resolve({ data: [], error: null }));
    return chain;
  });

  return builder;
}

/** Creates a mock Supabase client */
export function createMockSupabaseClient() {
  const queryBuilder = createQueryBuilder();

  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
    _queryBuilder: queryBuilder,
  };
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>;
