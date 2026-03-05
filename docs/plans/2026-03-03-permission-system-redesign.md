# Permission System Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the messy 3-layer permission system (hardcoded email + system_role + global_permissions) with a clean role-based system derived from organizational data (position level + department membership).

**Architecture:** Create a Supabase RPC function that returns a user's app role derived from `sys_positions.level` + `sys_profile_departments`. Build a `usePermissions()` React hook as the single source of truth for all permission checks. Remove all hardcoded email comparisons and scattered permission logic.

**Tech Stack:** React + TypeScript, Supabase (RPC + RLS), Vite

---

## Task 1: Create Supabase RPC `get_shopee_app_permissions`

**Files:**
- Create: Supabase migration (via `mcp__supabase__apply_migration`)

**Context:** We need a single RPC call that returns everything the frontend needs: the user's role in the app, their default features, per-user overrides, and managed member IDs (for leader shop visibility).

**Step 1: Create the RPC function**

```sql
CREATE OR REPLACE FUNCTION get_shopee_app_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_role text := null;
  v_position_level int := null;
  v_is_super_admin boolean := false;
  v_permissions jsonb := null;
  v_managed_member_ids uuid[] := '{}';
  v_shopee_dept_id uuid := 'd552e806-e27e-4b1e-a293-ab72714d2c56';
BEGIN
  -- Check super_admin in sys_profile_system_roles
  SELECT EXISTS(
    SELECT 1 FROM sys_profile_system_roles psr
    JOIN sys_system_roles sr ON sr.id = psr.system_role_id
    WHERE psr.profile_id = p_user_id AND sr.name = 'super_admin'
  ) INTO v_is_super_admin;

  IF v_is_super_admin THEN
    v_role := 'super_admin';
  ELSE
    -- Get position level from Phòng Vận Hành Shopee
    SELECT pos.level INTO v_position_level
    FROM sys_profile_departments pd
    JOIN sys_positions pos ON pos.id = pd.role_id
    WHERE pd.profile_id = p_user_id
      AND pd.department_id = v_shopee_dept_id;

    IF v_position_level IS NOT NULL THEN
      v_role := CASE
        WHEN v_position_level <= 2 THEN 'admin'
        WHEN v_position_level = 3 THEN 'leader'
        ELSE 'member'
      END;
    END IF;
  END IF;

  -- Get per-user permission overrides
  SELECT p.permissions INTO v_permissions
  FROM sys_profiles p
  WHERE p.id = p_user_id;

  -- If leader or admin, get managed member IDs
  IF v_role IN ('leader', 'admin', 'super_admin') THEN
    SELECT array_agg(pd.profile_id) INTO v_managed_member_ids
    FROM sys_profile_departments pd
    WHERE pd.manager_id = p_user_id
      AND pd.department_id = v_shopee_dept_id;
  END IF;

  v_result := jsonb_build_object(
    'role', v_role,
    'position_level', v_position_level,
    'permissions_override', COALESCE(v_permissions->'shopee_features', 'null'::jsonb),
    'managed_member_ids', COALESCE(to_jsonb(v_managed_member_ids), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;
```

**Step 2: Verify the RPC works**

```sql
-- Test with betacom.work@gmail.com (super_admin)
SELECT get_shopee_app_permissions('1fc158db-96cc-4c4e-a51b-6be382264f3b');
-- Expected: {"role": "super_admin", ...}

-- Test with Hoàng Quốc Bình (Trưởng phòng, level 2)
SELECT get_shopee_app_permissions('f1d221a8-06ae-4974-ae8a-7e309d063830');
-- Expected: {"role": "admin", "position_level": 2, ...}

-- Test with a Leader
SELECT get_shopee_app_permissions('51711df2-b3ba-4faa-82fb-b25cdc74b061');
-- Expected: {"role": "leader", "position_level": 3, "managed_member_ids": [...]}
```

**Step 3: Commit**

```
feat: add get_shopee_app_permissions RPC function
```

---

## Task 2: Create `usePermissions` hook

**Files:**
- Create: `src/hooks/usePermissions.ts`

**Context:** Single source of truth for all permission checks. Fetches data from the RPC once, caches it, and provides helper functions.

**Step 1: Create the hook file**

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/shopee/supabase-client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'super_admin' | 'admin' | 'leader' | 'member';

interface PermissionsState {
  role: AppRole | null;
  positionLevel: number | null;
  permissionsOverride: { add?: string[]; remove?: string[] } | null;
  managedMemberIds: string[];
  isLoading: boolean;
}

// Role default features
const ROLE_DEFAULTS: Record<AppRole, string[]> = {
  super_admin: ['*'],
  admin: [
    'home', 'products', 'flash-sale', 'notifications', 'docs',
    'settings/profile', 'settings/shops', 'settings/users', 'settings/push-logs',
  ],
  leader: [
    'home', 'products', 'flash-sale', 'notifications', 'docs',
    'settings/profile',
  ],
  member: [
    'home', 'settings/profile',
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

  return {
    ...state,
    systemRole: state.role,
    canAccessApp,
    isSuperAdmin,
    isAdmin,
    features,
    hasFeature,
  };
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat: add usePermissions hook as central permission authority
```

---

## Task 3: Create `PermissionsProvider` context

**Files:**
- Create: `src/contexts/PermissionsContext.tsx`
- Modify: `src/App.tsx`

**Context:** Wrap the hook in a context so all components share one instance (one RPC call, not per-component).

**Step 1: Create PermissionsContext**

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { usePermissions, AppRole } from '@/hooks/usePermissions';

interface PermissionsContextValue {
  systemRole: AppRole | null;
  positionLevel: number | null;
  managedMemberIds: string[];
  canAccessApp: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
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

export function usePermissionsContext() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissionsContext must be used within PermissionsProvider');
  return ctx;
}
```

**Step 2: Add PermissionsProvider to App.tsx**

In `src/App.tsx`, add `PermissionsProvider` inside `AuthProvider` (needs auth user to work):

```tsx
import { PermissionsProvider } from '@/contexts/PermissionsContext';

// In the provider stack, wrap inside AuthProvider:
<AuthProvider>
  <PermissionsProvider>
    <ShopeeAuthProvider>
      {/* ... rest of app */}
    </ShopeeAuthProvider>
  </PermissionsProvider>
</AuthProvider>
```

**Step 3: Verify app still loads**

Run: `npm run dev` — check browser, no errors in console.

**Step 4: Commit**

```
feat: add PermissionsProvider context wrapping usePermissions hook
```

---

## Task 4: Update `menu-config.ts`

**Files:**
- Modify: `src/config/menu-config.ts`

**Context:** Remove `ADMIN_EMAIL` export, remove `adminOnly` flag. All items use `permissionKey` only.

**Step 1: Remove ADMIN_EMAIL constant**

Delete line 31: `export const ADMIN_EMAIL = 'betacom.work@gmail.com';`

**Step 2: Remove `adminOnly` from MenuItem interface**

Remove `adminOnly?: boolean;` from `MenuItem` and `MenuChildItem` interfaces.

**Step 3: Add `permissionKey` to admin-only items**

Change these items from `adminOnly: true` to using `permissionKey`:
- "Quản lý Shop": `permissionKey: 'settings/shops'` (remove `adminOnly: true`)
- "Quản lý người dùng": `permissionKey: 'settings/users'` (remove `adminOnly: true`)
- "Push Logs": `permissionKey: 'settings/push-logs'` (remove `adminOnly: true`)

**Step 4: Remove `getAssignablePermissions` and `getAllAssignablePermissionKeys`**

These functions filtered by `adminOnly` — no longer needed. Remove them.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit` — fix any errors from removed exports.

**Step 6: Commit**

```
refactor: remove ADMIN_EMAIL and adminOnly from menu config
```

---

## Task 5: Update `Sidebar.tsx`

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Context:** Replace email check + global permissions fetch with `usePermissionsContext()`.

**Step 1: Replace imports**

Remove:
```typescript
import { ADMIN_EMAIL, ... } from '@/config/menu-config';
```

Add:
```typescript
import { usePermissionsContext } from '@/contexts/PermissionsContext';
```

**Step 2: Replace permission logic**

Remove (around lines 47-86):
- `const isSystemAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();`
- Entire `useEffect` that fetches `sys_settings.global_permissions` (lines 50-76)
- `const [userPermissions, setUserPermissions] = useState<string[]>([]);`
- The `hasPermission` function

Replace with:
```typescript
const { hasFeature, isSuperAdmin, canAccessApp } = usePermissionsContext();
```

**Step 3: Update menu filtering logic**

Replace the filter that checks `item.adminOnly` and `hasPermission(item.permissionKey)` with:

```typescript
const filteredItems = menuItems.filter(item => {
  if (item.permissionKey && !hasFeature(item.permissionKey)) return false;
  if (item.children) {
    item.children = item.children.filter(child =>
      !child.permissionKey || hasFeature(child.permissionKey)
    );
    return item.children.length > 0;
  }
  return true;
});
```

**Step 4: Verify sidebar renders correctly**

Run: `npm run dev` — check that menu items show/hide correctly for admin user.

**Step 5: Commit**

```
refactor: Sidebar uses usePermissionsContext instead of email check
```

---

## Task 6: Update `ShopeeAuthContext.tsx` — Shop visibility by role

**Files:**
- Modify: `src/contexts/ShopeeAuthContext.tsx`

**Context:** Currently loads ALL shops the user is a member of. Need to also load managed members' shops for leaders, and ALL shops for admins.

**Step 1: Import permissions context**

```typescript
import { usePermissionsContext } from '@/contexts/PermissionsContext';
```

**Step 2: Update `loadTokenFromSource` to use role-based shop loading**

Inside the context, use `usePermissionsContext()` to get `systemRole` and `managedMemberIds`.

For admin/super_admin: query ALL shops from `apishopee_shops` directly (not filtered by membership).

For leader: query `apishopee_shop_members` WHERE `profile_id = user.id OR profile_id = ANY(managedMemberIds)`.

For member: query `apishopee_shop_members` WHERE `profile_id = user.id` (current behavior).

**Step 3: Add dependency on permissions loading**

Wait for `usePermissionsContext().isLoading === false` before loading shops, since we need the role to determine visibility query.

**Step 4: Verify shop list loads correctly**

Run: `npm run dev` — login as different users, verify shop visibility matches role.

**Step 5: Commit**

```
feat: ShopeeAuthContext loads shops based on permission role
```

---

## Task 7: Update `ShopManagementPanel.tsx`

**Files:**
- Modify: `src/components/profile/ShopManagementPanel.tsx`

**Context:** Remove hardcoded `ADMIN_EMAIL` check. Use `usePermissionsContext()` for role checks and `apishopee_shop_members.role_id` for shop-level action permissions.

**Step 1: Remove ADMIN_EMAIL and email check**

Delete line 39: `const ADMIN_EMAIL = 'betacom.work@gmail.com';`
Delete line 79: `const isSystemAdmin = authUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();`

**Step 2: Import and use permissions**

```typescript
import { usePermissionsContext } from '@/contexts/PermissionsContext';

// Inside component:
const { isAdmin, isSuperAdmin } = usePermissionsContext();
```

**Step 3: Update action button visibility**

Replace `isSystemAdmin` checks with role-based logic:

- Refresh/Delete buttons: show if `isAdmin` OR if the user's `apishopee_shop_members.role_id` = admin role for that shop
- The shop data already includes `role_name` from the join query — use `shop.role_name === 'admin'` for shop-level admin check
- Combined check: `isAdmin || shop.role_name === 'admin'`

**Step 4: Update "Kết nối tài khoản" button**

Show connect button if `isAdmin` (only admins can connect new shops).

**Step 5: Verify actions work**

Run: `npm run dev` — check that refresh/delete buttons show only for appropriate roles.

**Step 6: Commit**

```
refactor: ShopManagementPanel uses role-based permission checks
```

---

## Task 8: Update `AllShopsPanel.tsx`

**Files:**
- Modify: `src/components/profile/AllShopsPanel.tsx`

**Step 1: Remove ADMIN_EMAIL and email check**

Delete line 39: `const ADMIN_EMAIL = 'betacom.work@gmail.com';`
Delete line 96: `const isSystemAdmin = ...`

**Step 2: Use permissions context**

```typescript
import { usePermissionsContext } from '@/contexts/PermissionsContext';

const { isAdmin } = usePermissionsContext();
```

Replace all `isSystemAdmin` references with `isAdmin`.

**Step 3: Commit**

```
refactor: AllShopsPanel uses role-based permission check
```

---

## Task 9: Update `UsersSettingsPage.tsx` — Per-user feature overrides

**Files:**
- Modify: `src/pages/settings/UsersSettingsPage.tsx`

**Context:** Replace the global permissions dialog with a per-user feature override UI. When admin clicks on a user, they can add/remove features beyond that user's role defaults.

**Step 1: Remove global permissions dialog**

Remove the "Chức năng cơ bản" button and the dialog that reads/writes `sys_settings.global_permissions`.

**Step 2: Add per-user permissions dialog**

Create a dialog that:
1. Shows the user's role and their default features (read-only, greyed out)
2. Shows checkboxes for features that can be added beyond defaults
3. Shows checkboxes for features that can be removed from defaults
4. Saves to `sys_profiles.permissions` as `{ "shopee_features": { "add": [...], "remove": [...] } }`

**Step 3: Update save logic**

```typescript
const saveUserPermissions = async (profileId: string, overrides: { add: string[]; remove: string[] }) => {
  const permissions = {
    shopee_features: {
      add: overrides.add.length > 0 ? overrides.add : undefined,
      remove: overrides.remove.length > 0 ? overrides.remove : undefined,
    },
  };

  await supabase
    .from('sys_profiles')
    .update({ permissions: Object.values(permissions.shopee_features).some(Boolean) ? permissions : null })
    .eq('id', profileId);
};
```

**Step 4: Verify the per-user permission override works**

1. Login as admin
2. Go to Settings > Users
3. Click on a member user
4. Add "flash-sale" feature
5. Login as that member — verify Flash Sale appears in sidebar

**Step 5: Commit**

```
feat: per-user feature override UI in UsersSettingsPage
```

---

## Task 10: Cleanup — Remove old permission artifacts

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/config/menu-config.ts`

**Step 1: Remove `system_role` display logic from AuthContext**

In `AuthContext.tsx` around line 63, remove:
```typescript
role_display_name: data.system_role === 'admin' ? 'Admin' : undefined
```

The `system_role` column in `sys_profiles` is still used by other parts of the system (HRM etc), so don't delete the column — just stop relying on it in this app.

**Step 2: Remove unused exports from menu-config**

Remove `getAssignablePermissions()` and `getAllAssignablePermissionKeys()` if not already removed in Task 4.

**Step 3: Search for remaining hardcoded email references**

Search codebase for `betacom.work@gmail.com` and `ADMIN_EMAIL` — remove any remaining references.

**Step 4: Search for remaining `system_role` checks**

Search for `system_role` in frontend code — replace any remaining checks with `usePermissionsContext()`.

**Step 5: Final verification**

Run: `npm run dev`
Test as 3 different roles:
1. Super admin (betacom.work@gmail.com) — sees everything
2. Leader — sees own shops + team shops, features match role defaults
3. Member — sees only assigned shops, limited features

**Step 6: Commit**

```
chore: remove legacy permission artifacts (ADMIN_EMAIL, global_permissions, system_role checks)
```

---

## Task Order & Dependencies

```
Task 1 (DB RPC)
  └── Task 2 (usePermissions hook)
        └── Task 3 (PermissionsProvider + App.tsx)
              ├── Task 4 (menu-config) ─── can run parallel with 5-8
              ├── Task 5 (Sidebar)
              ├── Task 6 (ShopeeAuthContext)
              ├── Task 7 (ShopManagementPanel)
              └── Task 8 (AllShopsPanel)
                    └── Task 9 (UsersSettingsPage - per-user UI)
                          └── Task 10 (Cleanup)
```

Tasks 4-8 can be done in any order after Task 3.
Task 9 depends on the permission system being in place.
Task 10 is final cleanup after everything works.
