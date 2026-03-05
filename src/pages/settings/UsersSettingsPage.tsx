/**
 * Users Settings Page - Quản lý người dùng (Admin only)
 * Hiển thị danh sách người dùng và cho phép admin tạo tài khoản mới
 * Per-user feature overrides (stored in sys_profiles.permissions)
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SimpleDataTable, CellText, CellBadge, CellActions } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { Plus, UserPlus, Mail, User, Phone, Shield, RefreshCw, Trash2, Store, Search, Save, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getFeaturePermissions } from '@/config/menu-config';
import { AppRole, ROLE_DEFAULTS } from '@/hooks/usePermissions';

const ALL_FEATURES = getFeaturePermissions();

interface ShopInfo {
  id: string;
  shop_id: number;
  shop_name: string | null;
  shop_logo?: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  system_role: 'admin' | 'user';
  join_date: string | null;
  created_at: string;
  updated_at: string;
  shops?: ShopInfo[];
  permissions?: Record<string, unknown> | null;
  appRole?: AppRole | null;
  leaderName?: string | null;
}

const SYSTEM_ROLES = [
  { value: 'admin', label: 'Quản trị viên', description: 'Toàn quyền quản lý hệ thống' },
  { value: 'user', label: 'Người dùng', description: 'Quyền sử dụng cơ bản' },
];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Quản trị viên',
  leader: 'Trưởng nhóm',
  member: 'Thành viên',
};

export default function UsersSettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Permission dialog state
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Shop permission state
  const [allShops, setAllShops] = useState<ShopInfo[]>([]);
  const [selectedShopIds, setSelectedShopIds] = useState<string[]>([]);
  const [loadingPermissionData, setLoadingPermissionData] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  // Per-user feature override state
  const [userAppRole, setUserAppRole] = useState<AppRole | null>(null);
  const [featureAdds, setFeatureAdds] = useState<string[]>([]);
  const [featureRemoves, setFeatureRemoves] = useState<string[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterLeader, setFilterLeader] = useState<string>('all');
  const [filterShop, setFilterShop] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    systemRole: 'user' as 'admin' | 'user',
  });

  const SHOPEE_DEPT_ID = 'd552e806-e27e-4b1e-a293-ab72714d2c56';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profile IDs + manager IDs belonging to Shopee department
      const { data: deptMembers, error: deptError } = await supabase
        .from('sys_profile_departments')
        .select('profile_id, manager_id')
        .eq('department_id', SHOPEE_DEPT_ID);

      if (deptError) throw deptError;

      const shopeeProfileIds = (deptMembers || []).map(m => m.profile_id);
      const managerByUser: Record<string, string | null> = {};
      (deptMembers || []).forEach(m => {
        managerByUser[m.profile_id] = m.manager_id;
      });

      if (shopeeProfileIds.length === 0) {
        setUsers([]);
        return;
      }

      // Fetch only Shopee department users
      const { data: usersData, error: usersError } = await supabase
        .from('sys_profiles')
        .select('*, permissions')
        .in('id', shopeeProfileIds)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Fetch all shops (exclude demo shop 999999001)
      const { data: shopsData, error: shopsError } = await supabase
        .from('apishopee_shops')
        .select('id, shop_id, shop_name')
        .neq('shop_id', 999999001);

      if (shopsError) {
        console.error('Error fetching shops:', shopsError);
      }

      // Create shops lookup map
      const shopsMap: Record<string, ShopInfo> = {};
      (shopsData || []).forEach((shop) => {
        shopsMap[shop.id] = {
          id: shop.id,
          shop_id: shop.shop_id,
          shop_name: shop.shop_name,
        };
      });

      // Fetch shop members
      const { data: membersData, error: membersError } = await supabase
        .from('apishopee_shop_members')
        .select('profile_id, shop_id')
        .eq('is_active', true)
        .in('profile_id', shopeeProfileIds);

      if (membersError) {
        console.error('Error fetching shop members:', membersError);
      }

      // Group shops by user
      const shopsByUser: Record<string, ShopInfo[]> = {};
      (membersData || []).forEach((m) => {
        const shop = shopsMap[m.shop_id];
        if (shop) {
          if (!shopsByUser[m.profile_id]) {
            shopsByUser[m.profile_id] = [];
          }
          shopsByUser[m.profile_id].push(shop);
        }
      });

      // Fetch all manager names in one batch
      const allManagerIds = [...new Set(
        Object.values(managerByUser).filter((id): id is string => id !== null)
      )];
      const managerNameMap: Record<string, string> = {};
      if (allManagerIds.length > 0) {
        const { data: managerProfiles } = await supabase
          .from('sys_profiles')
          .select('id, full_name')
          .in('id', allManagerIds);
        (managerProfiles || []).forEach(p => {
          if (p.full_name) managerNameMap[p.id] = p.full_name;
        });
      }

      // Merge shops + leader into users
      const usersWithShops = (usersData || []).map(user => ({
        ...user,
        shops: shopsByUser[user.id] || [],
        leaderName: managerByUser[user.id] ? (managerNameMap[managerByUser[user.id]!] || null) : null,
      }));

      // Fetch app roles for all users via RPC
      const roleResults = await Promise.all(
        usersWithShops.map(user =>
          supabase.rpc('get_shopee_app_permissions', { p_user_id: user.id })
        )
      );

      // Build managed-members map: leaderId → [memberId, ...]
      const managedMembers: Record<string, string[]> = {};
      Object.entries(managerByUser).forEach(([profileId, managerId]) => {
        if (managerId) {
          if (!managedMembers[managerId]) managedMembers[managerId] = [];
          managedMembers[managerId].push(profileId);
        }
      });

      const allShopsList = Object.values(shopsMap);

      const usersWithRoles = usersWithShops.map((user, i) => {
        const role = (roleResults[i].data?.role as AppRole) || null;

        // Admin/super_admin: full access to all shops
        if (role === 'super_admin' || role === 'admin') {
          return { ...user, appRole: role, shops: allShopsList };
        }

        // Leader: own shops + shops of managed members
        if (role === 'leader') {
          const memberIds = managedMembers[user.id] || [];
          const memberShops = memberIds.flatMap(mid => shopsByUser[mid] || []);
          const ownShops = shopsByUser[user.id] || [];
          // Deduplicate by shop id
          const shopMap = new Map<string, ShopInfo>();
          [...ownShops, ...memberShops].forEach(s => shopMap.set(s.id, s));
          return { ...user, appRole: role, shops: [...shopMap.values()] };
        }

        return { ...user, appRole: role };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password) {
      toast.error('Vui lòng nhập email và mật khẩu');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Nếu session sắp hết hạn, refresh
      if (session && session.expires_at && (session.expires_at * 1000 - Date.now()) < 60000) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Không thể refresh session. Vui lòng đăng nhập lại.');
        }
      }

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone,
          systemRole: formData.systemRole,
          adminEmail: session?.user?.email,
        },
      });

      if (error) {
        throw new Error(error.message || 'Không thể tạo tài khoản');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const newUser: UserProfile = {
        id: data.user.id,
        email: formData.email,
        full_name: formData.fullName || null,
        phone: formData.phone || null,
        system_role: formData.systemRole,
        join_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUsers(prev => [newUser, ...prev]);

      toast.success('Tạo tài khoản thành công');
      setIsCreateDialogOpen(false);
      setFormData({ email: '', password: '', fullName: '', phone: '', systemRole: 'user' });
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể tạo tài khoản');
    } finally {
      setCreating(false);
    }
  };

  // Open permission dialog — load shops + user's app role + current overrides
  const openPermissionDialog = async (user: UserProfile) => {
    setSelectedUser(user);
    setIsPermissionDialogOpen(true);
    setShopSearchQuery('');
    setLoadingPermissionData(true);
    setUserAppRole(null);
    setFeatureAdds([]);
    setFeatureRemoves([]);

    try {
      const [shopsRes, memberRes, permRes] = await Promise.all([
        supabase
          .from('apishopee_shops')
          .select('id, shop_id, shop_name, shop_logo')
          .neq('shop_id', 999999001)
          .order('shop_name'),
        supabase
          .from('apishopee_shop_members')
          .select('shop_id')
          .eq('profile_id', user.id)
          .eq('is_active', true),
        supabase.rpc('get_shopee_app_permissions', { p_user_id: user.id }),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      if (memberRes.error) throw memberRes.error;

      setAllShops(shopsRes.data || []);
      setSelectedShopIds((memberRes.data || []).map(m => m.shop_id));

      // Set user's app role from RPC
      if (permRes.data?.role) {
        setUserAppRole(permRes.data.role as AppRole);
      }

      // Load current overrides from user's permissions field
      const overrides = user.permissions as Record<string, unknown> | null;
      const shopeeFeatures = overrides?.shopee_features as { add?: string[]; remove?: string[] } | undefined;
      setFeatureAdds(shopeeFeatures?.add || []);
      setFeatureRemoves(shopeeFeatures?.remove || []);
    } catch (error) {
      console.error('Error loading permission data:', error);
      toast.error('Không thể tải dữ liệu phân quyền');
    } finally {
      setLoadingPermissionData(false);
    }
  };

  // Compute role defaults for the selected user
  const roleDefaults = useMemo(() => {
    if (!userAppRole || userAppRole === 'super_admin') return [];
    return ROLE_DEFAULTS[userAppRole] || [];
  }, [userAppRole]);

  // Compute available features for override (exclude role defaults for adds, include only defaults for removes)
  const addableFeatures = useMemo(() => {
    return ALL_FEATURES.filter(f => !roleDefaults.includes(f.key));
  }, [roleDefaults]);

  // Toggle feature add
  const toggleFeatureAdd = (key: string) => {
    setFeatureAdds(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Save both shop assignments and per-user feature overrides
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setSavingPermissions(true);
    try {
      // --- Save shop assignments ---
      const { data: rolesData } = await supabase
        .from('apishopee_roles')
        .select('id')
        .eq('name', 'member')
        .single();

      const memberRoleId = rolesData?.id;

      const { data: currentMembers } = await supabase
        .from('apishopee_shop_members')
        .select('id, shop_id')
        .eq('profile_id', selectedUser.id)
        .eq('is_active', true);

      const currentShopIds = (currentMembers || []).map(m => m.shop_id);

      const shopsToAdd = selectedShopIds.filter(id => !currentShopIds.includes(id));
      const memberIdsToDelete = (currentMembers || [])
        .filter(m => !selectedShopIds.includes(m.shop_id))
        .map(m => m.id);

      if (shopsToAdd.length > 0 && memberRoleId) {
        const insertData = shopsToAdd.map(shopId => ({
          shop_id: shopId,
          profile_id: selectedUser.id,
          role_id: memberRoleId,
          is_active: true,
        }));
        const { error: insertError } = await supabase
          .from('apishopee_shop_members')
          .insert(insertData);
        if (insertError) throw insertError;
      }

      if (memberIdsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('apishopee_shop_members')
          .delete()
          .in('id', memberIdsToDelete);
        if (deleteError) throw deleteError;
      }

      // --- Save per-user feature overrides ---
      const hasOverrides = featureAdds.length > 0 || featureRemoves.length > 0;
      const permissions = hasOverrides
        ? {
            shopee_features: {
              ...(featureAdds.length > 0 ? { add: featureAdds } : {}),
              ...(featureRemoves.length > 0 ? { remove: featureRemoves } : {}),
            },
          }
        : null;

      const { error: permError } = await supabase
        .from('sys_profiles')
        .update({ permissions })
        .eq('id', selectedUser.id);

      if (permError) throw permError;

      // Update local state
      const updatedShops = allShops.filter(s => selectedShopIds.includes(s.id));
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id
          ? { ...u, shops: updatedShops, permissions }
          : u
      ));

      toast.success('Đã cập nhật phân quyền cho người dùng');
      setIsPermissionDialogOpen(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Không thể cập nhật phân quyền');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Toggle shop selection
  const toggleShopSelection = (shopId: string) => {
    setSelectedShopIds(prev =>
      prev.includes(shopId)
        ? prev.filter(id => id !== shopId)
        : [...prev, shopId]
    );
  };

  const toggleAllShops = () => {
    if (selectedShopIds.length === allShops.length) {
      setSelectedShopIds([]);
    } else {
      setSelectedShopIds(allShops.map(s => s.id));
    }
  };

  const filteredShops = useMemo(() => {
    const filtered = allShops.filter(shop =>
      !shopSearchQuery ||
      shop.shop_name?.toLowerCase().includes(shopSearchQuery.toLowerCase()) ||
      shop.shop_id.toString().includes(shopSearchQuery)
    );
    // Pin selected shops to top
    const selected = filtered.filter(s => selectedShopIds.includes(s.id));
    const unselected = filtered.filter(s => !selectedShopIds.includes(s.id));
    return [...selected, ...unselected];
  }, [allShops, shopSearchQuery, selectedShopIds]);

  // Derived filter options
  const leaderOptions = useMemo(() => {
    const leaders = [...new Set(users.map(u => u.leaderName).filter((n): n is string => !!n))];
    return leaders.sort((a, b) => a.localeCompare(b, 'vi'));
  }, [users]);

  const shopOptions = useMemo(() => {
    const shopMap = new Map<string, string>();
    users.forEach(u => {
      (u.shops || []).forEach(s => {
        shopMap.set(s.id, s.shop_name || `Shop ${s.shop_id}`);
      });
    });
    return [...shopMap.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [users]);

  const activeFilterCount = [
    searchQuery,
    filterRole !== 'all' ? filterRole : '',
    filterLeader !== 'all' ? filterLeader : '',
    filterShop !== 'all' ? filterShop : '',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterRole('all');
    setFilterLeader('all');
    setFilterShop('all');
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = user.full_name?.toLowerCase().includes(q);
        const matchEmail = user.email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      // Role
      if (filterRole !== 'all') {
        if (user.appRole !== filterRole) return false;
      }
      // Leader
      if (filterLeader !== 'all') {
        if (user.leaderName !== filterLeader) return false;
      }
      // Shop
      if (filterShop !== 'all') {
        const hasShop = (user.shops || []).some(s => s.id === filterShop);
        if (!hasShop) return false;
      }
      return true;
    });
  }, [users, searchQuery, filterRole, filterLeader, filterShop]);

  const columns = [
    {
      key: 'user',
      header: 'Người dùng',
      width: '280px',
      mobileHeader: true,
      render: (user: UserProfile) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user.full_name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {user.full_name || 'Chưa cập nhật'}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'app_role',
      header: 'Vai trò',
      width: '140px',
      mobileBadge: true,
      render: (user: UserProfile) => {
        const role = user.appRole;
        if (!role) {
          return <CellBadge variant="default">Chưa phân quyền</CellBadge>;
        }
        const isAdminRole = role === 'super_admin' || role === 'admin';
        return (
          <CellBadge variant={isAdminRole ? 'warning' : 'default'}>
            {isAdminRole ? (
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {ROLE_LABELS[role]}
              </span>
            ) : (
              ROLE_LABELS[role]
            )}
          </CellBadge>
        );
      },
    },
    {
      key: 'leader',
      header: 'Leader',
      width: '160px',
      hideOnMobile: true,
      render: (user: UserProfile) => {
        if (!user.leaderName) {
          return <CellText muted>-</CellText>;
        }
        return <CellText>{user.leaderName}</CellText>;
      },
    },
    {
      key: 'shops',
      header: 'Shop quản lý',
      width: '200px',
      hideOnMobile: true,
      render: (user: UserProfile) => {
        const shops = user.shops || [];
        if (shops.length === 0) {
          return <CellText muted>-</CellText>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {shops.slice(0, 2).map((shop) => (
              <span
                key={shop.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                title={shop.shop_name || `Shop ${shop.shop_id}`}
              >
                <Store className="w-3 h-3" />
                <span className="max-w-[80px] truncate">{shop.shop_name || shop.shop_id}</span>
              </span>
            ))}
            {shops.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                +{shops.length - 2}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '100px',
      render: (user: UserProfile) => (
        <CellActions>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 w-7 p-0"
            onClick={() => openPermissionDialog(user)}
            title="Phân quyền"
            disabled={user.id === currentUser?.id}
          >
            <Shield className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
            onClick={() => {
              toast.info('Chức năng đang phát triển');
            }}
            title="Xóa người dùng"
            disabled={user.id === currentUser?.id}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </CellActions>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 bg-white min-h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800">Quản lý người dùng</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Xem danh sách người dùng trong phòng ban Shopee
        </p>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm theo tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role filter */}
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <SelectValue placeholder="Vai trò" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả vai trò</SelectItem>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Leader filter */}
          <Select value={filterLeader} onValueChange={setFilterLeader}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <SelectValue placeholder="Leader" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả leader</SelectItem>
              {leaderOptions.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Shop filter */}
          <Select value={filterShop} onValueChange={setFilterShop}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                <SelectValue placeholder="Shop" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả shop</SelectItem>
              {shopOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-slate-500 hover:text-slate-700 h-9 px-3 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Xóa bộ lọc ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="border rounded-lg overflow-hidden">
          <SimpleDataTable
            columns={columns}
            data={filteredUsers}
            keyExtractor={(user) => user.id}
            loading={loading}
            loadingMessage="Đang tải danh sách người dùng..."
            emptyMessage={activeFilterCount > 0 ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người dùng nào'}
            emptyDescription={activeFilterCount > 0 ? 'Thử thay đổi bộ lọc để xem kết quả khác' : 'Tạo tài khoản mới để bắt đầu'}
          />
        </div>
        {!loading && users.length > 0 && (
          <p className="text-xs sm:text-sm text-slate-500 mt-2 sm:mt-3">
            {filteredUsers.length < users.length
              ? `Hiển thị ${filteredUsers.length} / ${users.length} người dùng`
              : `Tổng cộng: ${users.length} người dùng`
            }
          </p>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-orange-500" />
              Tạo tài khoản mới
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin để tạo tài khoản cho người dùng mới
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Mật khẩu <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                Họ và tên
              </Label>
              <Input
                id="fullName"
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500" />
                Số điện thoại
              </Label>
              <Input
                id="phone"
                placeholder="0901234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemRole" className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" />
                Vai trò <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.systemRole}
                onValueChange={(value: 'admin' | 'user') =>
                  setFormData({ ...formData, systemRole: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-slate-500">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={creating}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo tài khoản
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Dialog — Shop Assignment + Per-User Feature Overrides */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              {selectedUser && (
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {selectedUser.full_name?.[0]?.toUpperCase() || selectedUser.email[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div>
                <DialogTitle className="text-lg">
                  {selectedUser?.full_name || 'Chưa cập nhật'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {selectedUser?.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingPermissionData ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-7 h-7 animate-spin text-slate-400" />
              <span className="ml-3 text-base text-slate-500">Đang tải dữ liệu...</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-5">
                {/* Section 1: User Role Info */}
                {userAppRole && (
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Vai trò trong ứng dụng</p>
                      <p className="text-base font-semibold text-slate-800 mt-0.5">
                        {ROLE_LABELS[userAppRole] || userAppRole}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 max-w-[140px] text-right leading-tight">
                      Xác định từ vị trí trong phòng ban
                    </span>
                  </div>
                )}

                {!userAppRole && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <Shield className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                      Người dùng chưa được gán vào phòng ban Shopee. Không có vai trò trong ứng dụng.
                    </p>
                  </div>
                )}

                {/* Section 2: Per-user feature overrides (only show for non-super_admin) */}
                {userAppRole && userAppRole !== 'super_admin' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                      Quản lý chức năng
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      {addableFeatures.map(feature => {
                        const Icon = feature.icon;
                        const isAdded = featureAdds.includes(feature.key);
                        return (
                          <label
                            key={feature.key}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                              isAdded
                                ? 'border-green-300 bg-green-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox
                              checked={isAdded}
                              onCheckedChange={() => toggleFeatureAdd(feature.key)}
                              className="w-4 h-4"
                            />
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                              isAdded ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-sm font-medium ${isAdded ? 'text-green-700' : 'text-slate-600'}`}>
                              {feature.label}
                            </span>
                          </label>
                        );
                      })}
                      {addableFeatures.length === 0 && (
                        <p className="text-sm text-slate-400 py-3 col-span-2 text-center">Đã có đầy đủ chức năng</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 3: Shop Assignment */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                      Quyền truy cập Shop
                    </h3>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <span>Chọn tất cả</span>
                      <Checkbox
                        checked={selectedShopIds.length === allShops.length && allShops.length > 0}
                        onCheckedChange={toggleAllShops}
                        disabled={allShops.length === 0}
                        className="w-5 h-5"
                      />
                    </label>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Tìm shop theo tên hoặc ID..."
                      value={shopSearchQuery}
                      onChange={(e) => setShopSearchQuery(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>

                  <div className="max-h-[240px] overflow-y-auto pr-1">
                    {allShops.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <Store className="w-10 h-10 mb-2" />
                        <p className="text-sm">Chưa có shop nào</p>
                      </div>
                    ) : filteredShops.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <Search className="w-10 h-10 mb-2" />
                        <p className="text-sm">Không tìm thấy shop</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredShops.map((shop) => (
                          <label
                            key={shop.id}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
                              selectedShopIds.includes(shop.id)
                                ? 'border-orange-300 bg-orange-50 shadow-sm'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox
                              checked={selectedShopIds.includes(shop.id)}
                              onCheckedChange={() => toggleShopSelection(shop.id)}
                              className="w-5 h-5"
                            />
                            {shop.shop_logo ? (
                              <img
                                src={shop.shop_logo}
                                alt={shop.shop_name || ''}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                {shop.shop_name?.[0]?.toUpperCase() || 'S'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {shop.shop_name || `Shop ${shop.shop_id}`}
                              </p>
                              <p className="text-xs text-slate-500">ID: {shop.shop_id}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-orange-50 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-orange-700">
                      Đã chọn <strong>{selectedShopIds.length}</strong> / {allShops.length} shop
                    </p>
                    {selectedShopIds.length > 0 && (
                      <button
                        type="button"
                        className="text-sm text-orange-600 hover:text-orange-800 cursor-pointer font-medium"
                        onClick={() => setSelectedShopIds([])}
                      >
                        Bỏ chọn tất cả
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="border-t pt-5 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsPermissionDialogOpen(false)}
              disabled={savingPermissions}
            >
              Hủy
            </Button>
            <Button
              size="lg"
              onClick={handleSavePermissions}
              disabled={savingPermissions || loadingPermissionData}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-8"
            >
              {savingPermissions ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Lưu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
