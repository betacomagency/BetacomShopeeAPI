import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'super_admin' | 'admin' | 'leader' | 'member';

interface PermissionsState {
  role: AppRole | null;
  positionLevel: number | null;
  managedMemberIds: string[];
  features: string[];
  isLoading: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [state, setState] = useState<PermissionsState>({
    role: null,
    positionLevel: null,
    managedMemberIds: [],
    features: [],
    isLoading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setState(prev => ({ ...prev, role: null, features: [], isLoading: false }));
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase.rpc('get_shopee_app_permissions', {
        p_user_id: user!.id,
      });

      if (cancelled) return;

      if (error || !data) {
        setState(prev => ({ ...prev, role: null, features: [], isLoading: false }));
        return;
      }

      setState({
        role: data.role as AppRole | null,
        positionLevel: data.position_level,
        managedMemberIds: data.managed_member_ids ?? [],
        features: data.features ?? [],
        isLoading: false,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const hasFeature = useCallback(
    (key: string) => {
      if (!state.role) return false;
      if (state.features.includes('*')) return true;
      return state.features.includes(key);
    },
    [state.role, state.features],
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
    features: state.features,
    hasFeature,
  };
}
