import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'super_admin' | 'admin' | 'leader' | 'member';

interface PermissionsState {
  role: AppRole | null;
  positionLevel: number | null;
  permissionsOverride: { add?: string[]; remove?: string[] } | null;
  managedMemberIds: string[];
  isLoading: boolean;
}

export const ROLE_DEFAULTS: Record<AppRole, string[]> = {
  super_admin: ['*'],
  admin: [
    'home', 'products', 'flash-sale', 'notifications', 'shop-performance', 'docs',
    'admin-panel',
    'settings/profile',
  ],
  leader: [
    'home', 'products', 'flash-sale', 'notifications', 'shop-performance', 'docs',
    'settings/profile',
  ],
  member: [
    'home', 'shop-performance', 'settings/profile',
  ],
};

export function usePermissions() {
  const { user } = useAuth();
  const [state, setState] = useState<PermissionsState>({
    role: null,
    positionLevel: null,
    permissionsOverride: null,
    managedMemberIds: [],
    isLoading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setState(prev => ({ ...prev, role: null, isLoading: false }));
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.rpc('get_shopee_app_permissions', {
        p_user_id: user!.id,
      });

      if (cancelled) return;

      if (error || !data) {
        setState(prev => ({ ...prev, role: null, isLoading: false }));
        return;
      }

      setState({
        role: data.role as AppRole | null,
        positionLevel: data.position_level,
        permissionsOverride: data.permissions_override,
        managedMemberIds: data.managed_member_ids ?? [],
        isLoading: false,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const features = useMemo(() => {
    const { role, permissionsOverride } = state;
    if (!role) return [];
    if (role === 'super_admin') return ['*'];

    const defaults = [...ROLE_DEFAULTS[role]];

    if (permissionsOverride?.add) {
      for (const key of permissionsOverride.add) {
        if (!defaults.includes(key)) defaults.push(key);
      }
    }
    if (permissionsOverride?.remove) {
      return defaults.filter(k => !permissionsOverride.remove!.includes(k));
    }

    return defaults;
  }, [state.role, state.permissionsOverride]);

  const hasFeature = useCallback(
    (key: string) => {
      if (!state.role) return false;
      if (features.includes('*')) return true;
      return features.includes(key);
    },
    [state.role, features],
  );

  const canAccessApp = state.role !== null;
  const isSuperAdmin = state.role === 'super_admin';
  const isAdmin = state.role === 'admin' || isSuperAdmin;
  const isLeader = state.role === 'leader';

  return {
    ...state,
    systemRole: state.role,
    canAccessApp,
    isSuperAdmin,
    isAdmin,
    isLeader,
    features,
    hasFeature,
  };
}
