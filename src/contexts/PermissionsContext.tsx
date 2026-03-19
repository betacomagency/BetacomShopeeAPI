import { createContext, useContext, ReactNode } from 'react';
import { usePermissions, AppRole } from '@/hooks/usePermissions';

interface PermissionsContextValue {
  systemRole: AppRole | null;
  positionLevel: number | null;
  managedMemberIds: string[];
  canAccessApp: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isLeader: boolean;
  isLoading: boolean;
  features: string[];
  hasFeature: (key: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const permissions = usePermissions();
  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePermissionsContext() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissionsContext must be used within PermissionsProvider');
  return ctx;
}
