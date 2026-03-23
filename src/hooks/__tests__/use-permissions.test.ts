/**
 * Tests for usePermissions hook — role derivation, hasFeature, canAccessApp
 */

import { vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// ── Supabase mock (inline factory — no outer variable reference) ───────────────
vi.mock('@supabase/supabase-js', () => {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'eq', 'single', 'insert', 'update', 'upsert']) {
    qb[m] = vi.fn().mockReturnValue(qb);
  }
  qb.single.mockResolvedValue({ data: null, error: null });

  const client = {
    from: vi.fn().mockReturnValue(qb),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };

  return { createClient: vi.fn(() => client) };
});

// ── AuthContext mock ──────────────────────────────────────────────────────────
// Use a shared object so individual tests can mutate currentUser
const authState = { user: { id: 'user-test-123', email: 'test@example.com' } as { id: string; email: string } | null };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}));

// Import after mocks are registered
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

function rpcData(overrides: Record<string, unknown> = {}) {
  return {
    role: 'member',
    position_level: 1,
    managed_member_ids: [],
    features: [],
    ...overrides,
  };
}

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'user-test-123', email: 'test@example.com' };
  });

  describe('unauthenticated user', () => {
    it('sets role to null and isLoading to false when user is null', async () => {
      authState.user = null;
      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.systemRole).toBeNull();
      expect(result.current.canAccessApp).toBe(false);
      expect(result.current.features).toEqual([]);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('role derivation', () => {
    it('super_admin: isSuperAdmin=true, isAdmin=true, isLeader=false', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'super_admin', features: ['*'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.systemRole).toBe('super_admin');
      expect(result.current.isSuperAdmin).toBe(true);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isLeader).toBe(false);
    });

    it('admin: isSuperAdmin=false, isAdmin=true, isLeader=false', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'admin', features: ['home', 'products'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.systemRole).toBe('admin');
      expect(result.current.isSuperAdmin).toBe(false);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isLeader).toBe(false);
    });

    it('leader: isSuperAdmin=false, isAdmin=false, isLeader=true', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'leader', features: ['home'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.systemRole).toBe('leader');
      expect(result.current.isSuperAdmin).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isLeader).toBe(true);
    });

    it('member: all role flags false', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'member', features: ['home'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.systemRole).toBe('member');
      expect(result.current.isSuperAdmin).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isLeader).toBe(false);
    });
  });

  describe('canAccessApp', () => {
    it('is true when a role is present', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'member' }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canAccessApp).toBe(true);
    });

    it('is false when RPC returns an error', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canAccessApp).toBe(false);
    });

    it('is false when RPC returns null data', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canAccessApp).toBe(false);
    });
  });

  describe('hasFeature', () => {
    it('returns false when there is no role', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'err' } });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasFeature('home')).toBe(false);
    });

    it('returns true for any key when features contains "*"', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'super_admin', features: ['*'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasFeature('home')).toBe(true);
      expect(result.current.hasFeature('flash-sale')).toBe(true);
      expect(result.current.hasFeature('nonexistent-key')).toBe(true);
    });

    it('returns true for a key that is in the features list', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'member', features: ['home', 'products'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasFeature('home')).toBe(true);
      expect(result.current.hasFeature('products')).toBe(true);
    });

    it('returns false for a key not in the features list', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'member', features: ['home'] }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasFeature('flash-sale')).toBe(false);
    });
  });

  describe('RPC parameters', () => {
    it('calls get_shopee_app_permissions with p_user_id', async () => {
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'member' }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockRpc).toHaveBeenCalledWith('get_shopee_app_permissions', {
        p_user_id: 'user-test-123',
      });
    });
  });

  describe('managedMemberIds', () => {
    it('exposes managed_member_ids from RPC response', async () => {
      const ids = ['member-a', 'member-b'];
      mockRpc.mockResolvedValueOnce({
        data: rpcData({ role: 'leader', managed_member_ids: ids }),
        error: null,
      });

      const { result } = renderHook(() => usePermissions(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.managedMemberIds).toEqual(ids);
    });
  });
});
