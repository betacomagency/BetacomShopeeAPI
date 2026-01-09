/**
 * Shop Members Panel - Quản lý quyền truy cập shop cho nhân viên
 * Chỉ admin (betacom.work@gmail.com) mới có quyền sử dụng
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { SimpleDataTable, CellText, CellBadge, CellActions } from '@/components/ui/data-table';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserPlus, Trash2 } from 'lucide-react';

const ADMIN_EMAIL = 'betacom.work@gmail.com';

// Simple in-memory cache
const cache: {
  members: ShopMember[];
  shops: Shop[];
  profiles: Profile[];
  roles: Role[];
  timestamp: number;
} = {
  members: [],
  shops: [],
  profiles: [],
  roles: [],
  timestamp: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

interface Shop {
  id: string;
  shop_id: number;
  shop_name: string | null;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
}

interface ShopMember {
  id: string;
  shop_id: string;
  profile_id: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
  profile: Profile;
  role: Role;
  shop: Shop;
}


export function ShopMembersPanel() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<ShopMember[]>(cache.members);
  const [shops, setShops] = useState<Shop[]>(cache.shops);
  const [profiles, setProfiles] = useState<Profile[]>(cache.profiles);
  const [roles, setRoles] = useState<Role[]>(cache.roles);
  const hasLoadedRef = useRef(false);

  // Add member dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [adding, setAdding] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<ShopMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter
  const [filterShopId, setFilterShopId] = useState<string>('all');

  const isSystemAdmin = authUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const loadData = useCallback(async (forceRefresh = false) => {
    // Nếu cache còn valid và không force refresh, skip
    const now = Date.now();
    if (!forceRefresh && cache.timestamp > 0 && now - cache.timestamp < CACHE_TTL) {
      setMembers(cache.members);
      setShops(cache.shops);
      setProfiles(cache.profiles);
      setRoles(cache.roles);
      setLoading(false);
      return;
    }

    // Chỉ show loading nếu chưa có data
    if (cache.members.length === 0) {
      setLoading(true);
    }
    
    try {
      // Load shops, profiles, roles in parallel
      const [shopsRes, profilesRes, rolesRes, membersRes] = await Promise.all([
        supabase.from('apishopee_shops').select('id, shop_id, shop_name').order('shop_name'),
        supabase.from('sys_profiles').select('id, email, full_name').order('full_name'),
        supabase.from('apishopee_roles').select('id, name, display_name').order('name'),
        supabase
          .from('apishopee_shop_members')
          .select(`
            id, shop_id, profile_id, role_id, is_active, created_at,
            sys_profiles(id, email, full_name),
            apishopee_roles(id, name, display_name),
            apishopee_shops(id, shop_id, shop_name)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);

      if (shopsRes.error) throw shopsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (membersRes.error) throw membersRes.error;

      setShops(shopsRes.data || []);
      setProfiles(profilesRes.data || []);
      setRoles(rolesRes.data || []);

      // Map members data
      const mappedMembers: ShopMember[] = (membersRes.data || []).map((m) => ({
        id: m.id,
        shop_id: m.shop_id,
        profile_id: m.profile_id,
        role_id: m.role_id,
        is_active: m.is_active,
        created_at: m.created_at,
        profile: m.sys_profiles as unknown as Profile,
        role: m.apishopee_roles as unknown as Role,
        shop: m.apishopee_shops as unknown as Shop,
      }));

      setMembers(mappedMembers);
      
      // Update cache
      cache.shops = shopsRes.data || [];
      cache.profiles = profilesRes.data || [];
      cache.roles = rolesRes.data || [];
      cache.members = mappedMembers;
      cache.timestamp = Date.now();
    } catch (err) {
      console.error('Error loading data:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải dữ liệu',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Reset ref khi component mount
  useEffect(() => {
    hasLoadedRef.current = false;
  }, []);

  useEffect(() => {
    if (isSystemAdmin && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadData();
    } else if (!isSystemAdmin) {
      setLoading(false);
    }
  }, [isSystemAdmin, loadData]);


  const handleAddMember = async () => {
    if (!selectedShopId || !selectedProfileId || !selectedRoleId) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn đầy đủ thông tin',
        variant: 'destructive',
      });
      return;
    }

    // Check if member already exists
    const existingMember = members.find(
      (m) => m.shop_id === selectedShopId && m.profile_id === selectedProfileId
    );
    if (existingMember) {
      toast({
        title: 'Lỗi',
        description: 'Nhân viên này đã có quyền truy cập shop này',
        variant: 'destructive',
      });
      return;
    }

    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('apishopee_shop_members')
        .insert({
          shop_id: selectedShopId,
          profile_id: selectedProfileId,
          role_id: selectedRoleId,
          is_active: true,
        })
        .select(`
          id, shop_id, profile_id, role_id, is_active, created_at,
          sys_profiles(id, email, full_name),
          apishopee_roles(id, name, display_name),
          apishopee_shops(id, shop_id, shop_name)
        `)
        .single();

      if (error) throw error;

      const newMember: ShopMember = {
        id: data.id,
        shop_id: data.shop_id,
        profile_id: data.profile_id,
        role_id: data.role_id,
        is_active: data.is_active,
        created_at: data.created_at,
        profile: data.sys_profiles as unknown as Profile,
        role: data.apishopee_roles as unknown as Role,
        shop: data.apishopee_shops as unknown as Shop,
      };

      setMembers((prev) => {
        const updated = [newMember, ...prev];
        cache.members = updated; // Update cache
        return updated;
      });
      setAddDialogOpen(false);
      setSelectedShopId('');
      setSelectedProfileId('');
      setSelectedRoleId('');

      toast({
        title: 'Thành công',
        description: 'Đã thêm quyền truy cập shop cho nhân viên',
      });
    } catch (err) {
      console.error('Error adding member:', err);
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('apishopee_shop_members')
        .delete()
        .eq('id', memberToDelete.id);

      if (error) throw error;

      setMembers((prev) => {
        const updated = prev.filter((m) => m.id !== memberToDelete.id);
        cache.members = updated; // Update cache
        return updated;
      });
      setDeleteDialogOpen(false);
      setMemberToDelete(null);

      toast({
        title: 'Thành công',
        description: 'Đã xóa quyền truy cập',
      });
    } catch (err) {
      console.error('Error deleting member:', err);
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filter members by shop
  const filteredMembers = filterShopId === 'all' 
    ? members 
    : members.filter((m) => m.shop_id === filterShopId);


  const columns = [
    {
      key: 'profile',
      header: 'Nhân viên',
      width: '250px',
      render: (member: ShopMember) => (
        <div>
          <span className="text-sm font-medium text-slate-800">
            {member.profile?.full_name || 'Chưa có tên'}
          </span>
          <p className="text-xs text-slate-400">
            {member.profile?.email}
          </p>
        </div>
      ),
    },
    {
      key: 'shop',
      header: 'Shop',
      width: '200px',
      render: (member: ShopMember) => (
        <div>
          <CellText>{member.shop?.shop_name || `Shop ${member.shop?.shop_id}`}</CellText>
          <p className="text-xs text-slate-400">ID: {member.shop?.shop_id}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      render: (member: ShopMember) => (
        <CellBadge variant={member.role?.name === 'admin' ? 'success' : 'default'}>
          {member.role?.display_name || member.role?.name}
        </CellBadge>
      ),
    },
    {
      key: 'created_at',
      header: 'Ngày thêm',
      render: (member: ShopMember) => (
        <CellText muted>
          {new Date(member.created_at).toLocaleDateString('vi-VN')}
        </CellText>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (member: ShopMember) => (
        <CellActions>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => {
              setMemberToDelete(member);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </CellActions>
      ),
    },
  ];

  // Không phải admin thì không hiển thị
  if (!isSystemAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Phân quyền Shop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>Phân quyền Shop ({filteredMembers.length})</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter by shop */}
              <Select value={filterShopId} onValueChange={setFilterShopId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Lọc theo shop" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả shop</SelectItem>
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.shop_name || `Shop ${shop.shop_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setAddDialogOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Thêm quyền
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleDataTable
            columns={columns}
            data={filteredMembers}
            keyExtractor={(member) => member.id}
            emptyMessage="Chưa có phân quyền nào"
            emptyDescription="Nhấn 'Thêm quyền' để phân quyền shop cho nhân viên"
          />
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Thêm quyền truy cập Shop</DialogTitle>
            <DialogDescription>
              Chọn nhân viên và shop để cấp quyền truy cập
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nhân viên <span className="text-red-500">*</span></Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhân viên" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                      {profile.full_name && (
                        <span className="text-slate-400 ml-2">({profile.email})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shop <span className="text-red-500">*</span></Label>
              <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id}>
                      {shop.shop_name || `Shop ${shop.shop_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vai trò <span className="text-red-500">*</span></Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleAddMember}
              disabled={adding || !selectedShopId || !selectedProfileId || !selectedRoleId}
            >
              {adding ? <Spinner size="sm" className="mr-2" /> : null}
              {adding ? 'Đang thêm...' : 'Thêm quyền'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Xác nhận xóa quyền</DialogTitle>
            <DialogDescription>
              Nhân viên sẽ không còn quyền truy cập shop này nữa.
            </DialogDescription>
          </DialogHeader>
          {memberToDelete && (
            <div className="py-4">
              <div className="bg-red-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-slate-800">
                  {memberToDelete.profile?.full_name || memberToDelete.profile?.email}
                </p>
                <p className="text-sm text-slate-500">
                  Shop: {memberToDelete.shop?.shop_name || `Shop ${memberToDelete.shop?.shop_id}`}
                </p>
                <p className="text-sm text-slate-500">
                  Vai trò: {memberToDelete.role?.display_name}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeleteMember} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa quyền'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ShopMembersPanel;
