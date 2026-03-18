/**
 * Users Settings Page - Quản lý người dùng & phân chia shop (Admin only)
 *
 * Features:
 * - Tab "Nhân sự": Bảng user + gán shop nhanh inline + bulk assign
 * - Tab "Tổng quan": Bảng ma trận shop × user
 * - Dialog phân quyền cải thiện
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  Plus, UserPlus, Mail, User, Phone, Shield, RefreshCw, Trash2,
  Store, Search, Save, X, Check, Users, Grid3X3, ChevronDown,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getFeaturePermissions } from '@/config/menu-config';
import { AppRole } from '@/hooks/usePermissions';

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
  assignedShops?: ShopInfo[]; // actual DB assignments (for overview matrix)
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

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  admin: 'bg-warning/10 text-warning border-warning',
  leader: 'bg-info/10 text-info border-info',
  member: 'bg-muted text-muted-foreground border-border',
};

export default function UsersSettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allShopsList, setAllShopsList] = useState<ShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

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
  const [userRoleFeatures, setUserRoleFeatures] = useState<string[]>([]);
  const [featureAdds, setFeatureAdds] = useState<string[]>([]);
  const [featureRemoves, setFeatureRemoves] = useState<string[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterLeader, setFilterLeader] = useState<string>('all');
  const [filterShop, setFilterShop] = useState<string>('all');

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkShopIds, setBulkShopIds] = useState<string[]>([]);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);

  // Inline shop popover
  const [inlinePopoverUserId, setInlinePopoverUserId] = useState<string | null>(null);
  const [inlineShopSearch, setInlineShopSearch] = useState('');
  const [savingInline, setSavingInline] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    systemRole: 'user' as 'admin' | 'user',
  });

  // Overview tab state
  const [overviewSearch, setOverviewSearch] = useState('');

  const SHOPEE_DEPT_ID = 'd552e806-e27e-4b1e-a293-ab72714d2c56';

  const fetchUsers = async () => {
    setLoading(true);
    try {
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

      const { data: usersData, error: usersError } = await supabase
        .from('sys_profiles')
        .select('*, permissions')
        .in('id', shopeeProfileIds)
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const { data: shopsData, error: shopsError } = await supabase
        .from('apishopee_shops')
        .select('id, shop_id, shop_name, shop_logo')
        .neq('shop_id', 999999001);

      if (shopsError) console.error('Error fetching shops:', shopsError);

      const shopsMap: Record<string, ShopInfo> = {};
      (shopsData || []).forEach((shop) => {
        shopsMap[shop.id] = shop;
      });

      const allShopsArr = Object.values(shopsMap);
      setAllShopsList(allShopsArr);

      const { data: membersData, error: membersError } = await supabase
        .from('apishopee_shop_members')
        .select('profile_id, shop_id')
        .eq('is_active', true)
        .in('profile_id', shopeeProfileIds);

      if (membersError) console.error('Error fetching shop members:', membersError);

      const shopsByUser: Record<string, ShopInfo[]> = {};
      (membersData || []).forEach((m) => {
        const shop = shopsMap[m.shop_id];
        if (shop) {
          if (!shopsByUser[m.profile_id]) shopsByUser[m.profile_id] = [];
          shopsByUser[m.profile_id].push(shop);
        }
      });

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

      const usersWithShops = (usersData || []).map(user => ({
        ...user,
        shops: shopsByUser[user.id] || [],
        leaderName: managerByUser[user.id] ? (managerNameMap[managerByUser[user.id]!] || null) : null,
      }));

      const roleResults = await Promise.all(
        usersWithShops.map(user =>
          supabase.rpc('get_shopee_app_permissions', { p_user_id: user.id })
        )
      );

      const managedMembers: Record<string, string[]> = {};
      Object.entries(managerByUser).forEach(([profileId, managerId]) => {
        if (managerId) {
          if (!managedMembers[managerId]) managedMembers[managerId] = [];
          managedMembers[managerId].push(profileId);
        }
      });

      const usersWithRoles = usersWithShops.map((user, i) => {
        const role = (roleResults[i].data?.role as AppRole) || null;
        const assignedShops = shopsByUser[user.id] || [];

        if (role === 'super_admin' || role === 'admin') {
          return { ...user, appRole: role, shops: allShopsArr, assignedShops };
        }

        if (role === 'leader') {
          const memberIds = managedMembers[user.id] || [];
          const memberShops = memberIds.flatMap(mid => shopsByUser[mid] || []);
          const ownShops = shopsByUser[user.id] || [];
          const shopMap = new Map<string, ShopInfo>();
          [...ownShops, ...memberShops].forEach(s => shopMap.set(s.id, s));
          return { ...user, appRole: role, shops: [...shopMap.values()], assignedShops };
        }

        return { ...user, appRole: role, assignedShops };
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

      if (error) throw new Error(error.message || 'Không thể tạo tài khoản');
      if (data?.error) throw new Error(data.error);

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

  // Open permission dialog
  const openPermissionDialog = async (user: UserProfile) => {
    setSelectedUser(user);
    setIsPermissionDialogOpen(true);
    setShopSearchQuery('');
    setLoadingPermissionData(true);
    setUserAppRole(null);
    setUserRoleFeatures([]);
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

      if (permRes.data?.role) {
        setUserAppRole(permRes.data.role as AppRole);
        setUserRoleFeatures(permRes.data.features ?? []);
      }

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

  const roleDefaults = useMemo(() => {
    if (!userAppRole || userAppRole === 'super_admin') return [];
    return userRoleFeatures;
  }, [userAppRole, userRoleFeatures]);

  const addableFeatures = useMemo(() => {
    return ALL_FEATURES.filter(f => !roleDefaults.includes(f.key));
  }, [roleDefaults]);

  const toggleFeatureAdd = (key: string) => {
    setFeatureAdds(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Save permissions (shop assignments + feature overrides)
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setSavingPermissions(true);
    try {
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

      const updatedShops = allShops.filter(s => selectedShopIds.includes(s.id));
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id
          ? { ...u, shops: updatedShops, permissions }
          : u
      ));

      toast.success('Đã cập nhật phân quyền');
      setIsPermissionDialogOpen(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Không thể cập nhật phân quyền');
    } finally {
      setSavingPermissions(false);
    }
  };

  const toggleShopSelection = (shopId: string) => {
    setSelectedShopIds(prev =>
      prev.includes(shopId) ? prev.filter(id => id !== shopId) : [...prev, shopId]
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
    const selected = filtered.filter(s => selectedShopIds.includes(s.id));
    const unselected = filtered.filter(s => !selectedShopIds.includes(s.id));
    return [...selected, ...unselected];
  }, [allShops, shopSearchQuery, selectedShopIds]);

  // --- Inline shop assignment ---
  const handleInlineToggleShop = useCallback(async (userId: string, shopId: string, isCurrentlyAssigned: boolean) => {
    setSavingInline(true);
    try {
      if (isCurrentlyAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('apishopee_shop_members')
          .delete()
          .eq('profile_id', userId)
          .eq('shop_id', shopId);
        if (error) throw error;

        setUsers(prev => prev.map(u =>
          u.id === userId
            ? {
                ...u,
                shops: (u.shops || []).filter(s => s.id !== shopId),
                assignedShops: (u.assignedShops || []).filter(s => s.id !== shopId),
              }
            : u
        ));
        toast.success('Đã bỏ gán shop');
      } else {
        // Add assignment
        const { data: rolesData } = await supabase
          .from('apishopee_roles')
          .select('id')
          .eq('name', 'member')
          .single();

        if (!rolesData?.id) throw new Error('Không tìm thấy role member');

        const { error } = await supabase
          .from('apishopee_shop_members')
          .insert({
            shop_id: shopId,
            profile_id: userId,
            role_id: rolesData.id,
            is_active: true,
          });
        if (error) throw error;

        const shop = allShopsList.find(s => s.id === shopId);
        if (shop) {
          setUsers(prev => prev.map(u =>
            u.id === userId
              ? {
                  ...u,
                  shops: [...(u.shops || []), shop],
                  assignedShops: [...(u.assignedShops || []), shop],
                }
              : u
          ));
        }
        toast.success('Đã gán shop');
      }
    } catch (error) {
      console.error('Error toggling shop:', error);
      toast.error('Không thể cập nhật');
    } finally {
      setSavingInline(false);
    }
  }, [allShopsList]);

  // --- Bulk assign ---
  const handleBulkAssign = async () => {
    if (selectedUserIds.length === 0 || bulkShopIds.length === 0) {
      toast.error('Vui lòng chọn nhân sự và shop');
      return;
    }

    setSavingBulk(true);
    try {
      const { data: rolesData } = await supabase
        .from('apishopee_roles')
        .select('id')
        .eq('name', 'member')
        .single();

      if (!rolesData?.id) throw new Error('Không tìm thấy role member');

      // Get existing assignments to avoid duplicates
      const { data: existing } = await supabase
        .from('apishopee_shop_members')
        .select('profile_id, shop_id')
        .eq('is_active', true)
        .in('profile_id', selectedUserIds)
        .in('shop_id', bulkShopIds);

      const existingSet = new Set(
        (existing || []).map(e => `${e.profile_id}:${e.shop_id}`)
      );

      const insertData: { shop_id: string; profile_id: string; role_id: string; is_active: boolean }[] = [];
      selectedUserIds.forEach(userId => {
        bulkShopIds.forEach(shopId => {
          if (!existingSet.has(`${userId}:${shopId}`)) {
            insertData.push({
              shop_id: shopId,
              profile_id: userId,
              role_id: rolesData.id,
              is_active: true,
            });
          }
        });
      });

      if (insertData.length > 0) {
        const { error } = await supabase
          .from('apishopee_shop_members')
          .insert(insertData);
        if (error) throw error;
      }

      // Update local state
      const newShops = allShopsList.filter(s => bulkShopIds.includes(s.id));
      setUsers(prev => prev.map(u => {
        if (!selectedUserIds.includes(u.id)) return u;
        const currentIds = new Set((u.shops || []).map(s => s.id));
        const currentAssignedIds = new Set((u.assignedShops || []).map(s => s.id));
        const toAdd = newShops.filter(s => !currentIds.has(s.id));
        const toAddAssigned = newShops.filter(s => !currentAssignedIds.has(s.id));
        return {
          ...u,
          shops: [...(u.shops || []), ...toAdd],
          assignedShops: [...(u.assignedShops || []), ...toAddAssigned],
        };
      }));

      toast.success(`Đã gán ${bulkShopIds.length} shop cho ${selectedUserIds.length} nhân sự`);
      setIsBulkAssignOpen(false);
      setSelectedUserIds([]);
      setBulkShopIds([]);
      setBulkSearchQuery('');
    } catch (error) {
      console.error('Error bulk assigning:', error);
      toast.error('Không thể gán hàng loạt');
    } finally {
      setSavingBulk(false);
    }
  };

  // Toggle user selection for bulk
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // moved after filteredUsers

  // Filter logic
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = user.full_name?.toLowerCase().includes(q);
        const matchEmail = user.email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      if (filterRole !== 'all' && user.appRole !== filterRole) return false;
      if (filterLeader !== 'all' && user.leaderName !== filterLeader) return false;
      if (filterShop !== 'all') {
        const hasShop = (user.shops || []).some(s => s.id === filterShop);
        if (!hasShop) return false;
      }
      return true;
    });
  }, [users, searchQuery, filterRole, filterLeader, filterShop]);

  const selectableUsers = useMemo(() =>
    filteredUsers.filter(u =>
      u.id !== currentUser?.id && u.appRole !== 'admin' && u.appRole !== 'super_admin'
    ), [filteredUsers, currentUser?.id]);

  const toggleAllUserSelection = () => {
    if (selectedUserIds.length === selectableUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUsers.map(u => u.id));
    }
  };

  // Inline filtered shops for popover
  const inlineFilteredShops = useMemo(() => {
    return allShopsList.filter(shop =>
      !inlineShopSearch ||
      shop.shop_name?.toLowerCase().includes(inlineShopSearch.toLowerCase()) ||
      shop.shop_id.toString().includes(inlineShopSearch)
    );
  }, [allShopsList, inlineShopSearch]);

  // Bulk filtered shops
  const bulkFilteredShops = useMemo(() => {
    return allShopsList.filter(shop =>
      !bulkSearchQuery ||
      shop.shop_name?.toLowerCase().includes(bulkSearchQuery.toLowerCase()) ||
      shop.shop_id.toString().includes(bulkSearchQuery)
    );
  }, [allShopsList, bulkSearchQuery]);

  // Overview data — show all non-admin users (member, leader, null role)
  const overviewUsers = useMemo(() => {
    return users.filter(u => u.appRole !== 'admin' && u.appRole !== 'super_admin');
  }, [users]);

  const overviewFilteredShops = useMemo(() => {
    if (!overviewSearch) return allShopsList;
    const q = overviewSearch.toLowerCase();
    return allShopsList.filter(s =>
      s.shop_name?.toLowerCase().includes(q) || s.shop_id.toString().includes(q)
    );
  }, [allShopsList, overviewSearch]);

  // Build assignment lookup for overview using actual DB assignments
  const assignmentMap = useMemo(() => {
    const map = new Map<string, Set<string>>(); // shopId -> Set<userId>
    overviewUsers.forEach(user => {
      (user.assignedShops || []).forEach(shop => {
        if (!map.has(shop.id)) map.set(shop.id, new Set());
        map.get(shop.id)!.add(user.id);
      });
    });
    return map;
  }, [overviewUsers]);

  // --- Columns ---
  const columns = [
    {
      key: 'user',
      header: 'Người dùng',
      width: '240px',
      mobileHeader: true,
      render: (user: UserProfile) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user.full_name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate text-sm">
              {user.full_name || 'Chưa cập nhật'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'leader',
      header: 'Leader',
      width: '140px',
      hideOnMobile: true,
      render: (user: UserProfile) => {
        if (!user.leaderName) return <CellText muted>-</CellText>;
        return <CellText>{user.leaderName}</CellText>;
      },
    },
    {
      key: 'shops',
      header: 'Shop được gán',
      width: '260px',
      hideOnMobile: true,
      render: (user: UserProfile) => {
        const shops = user.shops || [];
        const isAdminRole = user.appRole === 'admin' || user.appRole === 'super_admin';
        const isCurrentUser = user.id === currentUser?.id;
        const canEdit = !isAdminRole && !isCurrentUser;

        return (
          <div className="flex items-center gap-1.5">
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {shops.length === 0 ? (
                <span className="text-xs text-muted-foreground">Chưa gán shop</span>
              ) : (
                <>
                  {shops.slice(0, 2).map((shop) => (
                    <span
                      key={shop.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-info/10 text-info text-xs rounded-full max-w-[100px]"
                      title={shop.shop_name || `Shop ${shop.shop_id}`}
                    >
                      <Store className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{shop.shop_name || shop.shop_id}</span>
                    </span>
                  ))}
                  {shops.length > 2 && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                      +{shops.length - 2}
                    </span>
                  )}
                </>
              )}
            </div>
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
            className="text-info hover:text-info hover:bg-accent h-7 w-7 p-0"
            onClick={() => openPermissionDialog(user)}
            title="Phân quyền"
            disabled={user.id === currentUser?.id}
          >
            <Shield className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
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
    <div className="space-y-4 sm:space-y-6 bg-card min-h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b">
        <h1 className="text-lg sm:text-xl font-semibold text-foreground">Quản lý người dùng</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Phân chia shop và quản lý quyền truy cập cho nhân sự
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="users" className="gap-1.5 cursor-pointer">
                <Users className="w-4 h-4" />
                Nhân sự
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-1.5 cursor-pointer">
                <Grid3X3 className="w-4 h-4" />
                Tổng quan
              </TabsTrigger>
            </TabsList>

            {/* Bulk actions bar */}
            {activeTab === 'users' && selectedUserIds.length > 0 && (
              <div className="flex items-center gap-2 bg-brand/10 border border-brand rounded-lg px-3 py-1.5">
                <Checkbox
                  checked={selectedUserIds.length === selectableUsers.length && selectableUsers.length > 0}
                  onCheckedChange={toggleAllUserSelection}
                  className="w-4 h-4"
                  aria-label="Chọn tất cả"
                />
                <span className="text-sm font-medium text-brand">
                  Đã chọn {selectedUserIds.length}/{selectableUsers.length}
                </span>
                <Button
                  size="sm"
                  className="h-7 bg-brand hover:bg-brand/90 text-white cursor-pointer"
                  onClick={() => {
                    setBulkShopIds([]);
                    setBulkSearchQuery('');
                    setIsBulkAssignOpen(true);
                  }}
                >
                  <Store className="w-3.5 h-3.5 mr-1" />
                  Gán shop
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="text-brand hover:text-brand cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Tab: Nhân sự */}
          <TabsContent value="users">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mt-4">
              <div className="relative flex-1 w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
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

              <Select value={filterLeader} onValueChange={setFilterLeader}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
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

              <Select value={filterShop} onValueChange={setFilterShop}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
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

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-foreground h-9 px-3 flex-shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Xóa bộ lọc ({activeFilterCount})
                </Button>
              )}
            </div>

            {/* Users Table */}
            <div className="mt-4 pb-4">
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
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
                  {filteredUsers.length < users.length
                    ? `Hiển thị ${filteredUsers.length} / ${users.length} người dùng`
                    : `Tổng cộng: ${users.length} người dùng`
                  }
                </p>
              )}
            </div>
          </TabsContent>

          {/* Tab: Tổng quan (Ma trận shop × user) */}
          <TabsContent value="overview">
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm shop..."
                    value={overviewSearch}
                    onChange={(e) => setOverviewSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {overviewUsers.length} nhân sự | {overviewFilteredShops.length} shop
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Đang tải...</span>
                </div>
              ) : overviewUsers.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2" />
                  <p>Chưa có nhân sự (member/leader)</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-auto max-h-[70vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background border-b">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground sticky left-0 bg-background min-w-[200px] border-r">
                          Shop
                        </th>
                        {overviewUsers.map(user => (
                          <th
                            key={user.id}
                            className="text-center px-2 py-2.5 font-medium text-muted-foreground min-w-[80px]"
                            title={user.email}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {user.full_name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || 'U'}
                              </div>
                              <span className="text-xs truncate max-w-[70px]">
                                {user.full_name?.split(' ').pop() || user.email.split('@')[0]}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overviewFilteredShops.map((shop, idx) => (
                        <tr key={shop.id} className={idx % 2 === 0 ? 'bg-card' : 'bg-background/50'}>
                          <td className={`px-3 py-2 sticky left-0 border-r ${idx % 2 === 0 ? 'bg-card' : 'bg-background/50'}`}>
                            <div className="flex items-center gap-2">
                              {shop.shop_logo ? (
                                <img src={shop.shop_logo} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  {shop.shop_name?.[0]?.toUpperCase() || 'S'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate text-xs">
                                  {shop.shop_name || `Shop ${shop.shop_id}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          {overviewUsers.map(user => {
                            const isAssigned = assignmentMap.get(shop.id)?.has(user.id) || false;
                            return (
                              <td key={user.id} className="text-center px-2 py-2">
                                <button
                                  type="button"
                                  className={`w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                                    isAssigned
                                      ? 'bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive'
                                      : 'bg-muted text-muted-foreground hover:bg-brand/10 hover:text-brand'
                                  }`}
                                  title={isAssigned ? `Bỏ gán ${user.full_name || user.email} khỏi ${shop.shop_name || shop.shop_id}` : `Gán ${user.full_name || user.email} vào ${shop.shop_name || shop.shop_id}`}
                                  onClick={() => handleInlineToggleShop(user.id, shop.id, isAssigned)}
                                >
                                  {isAssigned ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand" />
              Tạo tài khoản mới
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin để tạo tài khoản cho người dùng mới
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Email <span className="text-destructive">*</span>
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
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Mật khẩu <span className="text-destructive">*</span>
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
                <User className="w-4 h-4 text-muted-foreground" />
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
                <Phone className="w-4 h-4 text-muted-foreground" />
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
                <Shield className="w-4 h-4 text-muted-foreground" />
                Vai trò <span className="text-destructive">*</span>
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
                        <span className="text-xs text-muted-foreground">{role.description}</span>
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
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 cursor-pointer"
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
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg">
                  {selectedUser?.full_name || 'Chưa cập nhật'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {selectedUser?.email}
                  {selectedUser?.leaderName && (
                    <span className="ml-2 text-muted-foreground">| Leader: {selectedUser.leaderName}</span>
                  )}
                </DialogDescription>
              </div>
              {userAppRole && (
                <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border ${ROLE_COLORS[userAppRole]}`}>
                  {ROLE_LABELS[userAppRole]}
                </span>
              )}
            </div>
          </DialogHeader>

          {loadingPermissionData ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-7 h-7 animate-spin text-muted-foreground" />
              <span className="ml-3 text-base text-muted-foreground">Đang tải dữ liệu...</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-5">
                {/* Warning for no role */}
                {!userAppRole && (
                  <div className="flex items-center gap-3 p-4 bg-warning/10 rounded-xl border border-warning">
                    <Shield className="w-5 h-5 text-warning flex-shrink-0" />
                    <p className="text-sm text-warning">
                      Người dùng chưa được gán vào phòng ban Shopee. Không có vai trò trong ứng dụng.
                    </p>
                  </div>
                )}

                {/* Section: Per-user feature overrides */}
                {userAppRole && userAppRole !== 'super_admin' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
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
                                ? 'border-green-300 bg-success/10 shadow-sm'
                                : 'border-border bg-card hover:border-border hover:bg-background'
                            }`}
                          >
                            <Checkbox
                              checked={isAdded}
                              onCheckedChange={() => toggleFeatureAdd(feature.key)}
                              className="w-4 h-4"
                            />
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                              isAdded ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-sm font-medium ${isAdded ? 'text-green-700' : 'text-muted-foreground'}`}>
                              {feature.label}
                            </span>
                          </label>
                        );
                      })}
                      {addableFeatures.length === 0 && (
                        <p className="text-sm text-muted-foreground py-3 col-span-2 text-center">Đã có đầy đủ chức năng</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Section: Shop Assignment */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
                      <Store className="w-4 h-4 text-muted-foreground" />
                      Quyền truy cập Shop
                    </h3>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
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
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm shop theo tên hoặc ID..."
                      value={shopSearchQuery}
                      onChange={(e) => setShopSearchQuery(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>

                  <div className="max-h-[240px] overflow-y-auto pr-1">
                    {allShops.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Store className="w-10 h-10 mb-2" />
                        <p className="text-sm">Chưa có shop nào</p>
                      </div>
                    ) : filteredShops.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
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
                                ? 'border-brand bg-brand/10 shadow-sm'
                                : 'border-border hover:bg-background'
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
                              <p className="text-sm font-medium text-foreground truncate">
                                {shop.shop_name || `Shop ${shop.shop_id}`}
                              </p>
                              <p className="text-xs text-muted-foreground">ID: {shop.shop_id}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-brand/10 rounded-xl flex items-center justify-between">
                    <p className="text-sm text-brand">
                      Đã chọn <strong>{selectedShopIds.length}</strong> / {allShops.length} shop
                    </p>
                    {selectedShopIds.length > 0 && (
                      <button
                        type="button"
                        className="text-sm text-brand hover:text-orange-800 cursor-pointer font-medium"
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
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              size="lg"
              onClick={handleSavePermissions}
              disabled={savingPermissions || loadingPermissionData}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-8 cursor-pointer"
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

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-brand" />
              Gán shop hàng loạt
            </DialogTitle>
            <DialogDescription>
              Chọn shop để gán cho {selectedUserIds.length} nhân sự đã chọn
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected users summary */}
            <div className="flex flex-wrap gap-1.5">
              {selectedUserIds.map(uid => {
                const u = users.find(u => u.id === uid);
                return (
                  <span key={uid} className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-foreground text-xs rounded-full">
                    <div className="w-4 h-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold">
                      {u?.full_name?.[0]?.toUpperCase() || u?.email[0]?.toUpperCase() || 'U'}
                    </div>
                    {u?.full_name?.split(' ').pop() || u?.email.split('@')[0]}
                  </span>
                );
              })}
            </div>

            {/* Shop search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm shop..."
                value={bulkSearchQuery}
                onChange={(e) => setBulkSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Shop list */}
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-1.5">
                {bulkFilteredShops.map(shop => {
                  const isSelected = bulkShopIds.includes(shop.id);
                  return (
                    <label
                      key={shop.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-brand bg-brand/10'
                          : 'border-border hover:bg-background'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          setBulkShopIds(prev =>
                            prev.includes(shop.id)
                              ? prev.filter(id => id !== shop.id)
                              : [...prev, shop.id]
                          );
                        }}
                        className="w-4 h-4"
                      />
                      {shop.shop_logo ? (
                        <img src={shop.shop_logo} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {shop.shop_name?.[0]?.toUpperCase() || 'S'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{shop.shop_name || `Shop ${shop.shop_id}`}</p>
                        <p className="text-xs text-muted-foreground">ID: {shop.shop_id}</p>
                      </div>
                    </label>
                  );
                })}
                {bulkFilteredShops.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Không tìm thấy shop</p>
                )}
              </div>
            </ScrollArea>

            {bulkShopIds.length > 0 && (
              <p className="text-sm text-brand bg-brand/10 rounded-lg p-2.5 text-center">
                Sẽ gán <strong>{bulkShopIds.length}</strong> shop cho <strong>{selectedUserIds.length}</strong> nhân sự
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkAssignOpen(false)}
              disabled={savingBulk}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={savingBulk || bulkShopIds.length === 0}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 cursor-pointer"
            >
              {savingBulk ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Đang gán...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Gán shop
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
