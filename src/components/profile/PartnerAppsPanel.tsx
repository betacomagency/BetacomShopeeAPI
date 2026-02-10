/**
 * Partner Apps Panel - Quản lý Partner Apps (Admin only)
 * CRUD cho Shopee Partner Apps (Betacom, Betacom Ads, etc.)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleDataTable, CellBadge, CellText } from '@/components/ui/data-table';
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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AppWindow, RefreshCw } from 'lucide-react';
import {
  getAllPartnerApps,
  createPartnerApp,
  updatePartnerApp,
  deletePartnerApp,
} from '@/lib/shopee/app-auth-client';
import type { PartnerApp, AppCategory } from '@/lib/shopee/partner-apps';
import { APP_CATEGORY_LABELS, APP_CATEGORY_COLORS } from '@/lib/shopee/partner-apps';

const ADMIN_EMAIL = 'betacom.work@gmail.com';

export function PartnerAppsPanel() {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<PartnerApp[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<PartnerApp | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<PartnerApp | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    partner_id: '',
    partner_key: '',
    partner_name: '',
    app_category: 'erp' as AppCategory,
    description: '',
    test_partner_id: '',
    test_partner_key: '',
  });

  const isSystemAdmin = authUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPartnerApps();
      setApps(data);
    } catch (error) {
      console.error('Error fetching partner apps:', error);
      toast.error('Không thể tải danh sách Partner Apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const resetForm = () => {
    setFormData({
      partner_id: '',
      partner_key: '',
      partner_name: '',
      app_category: 'erp',
      description: '',
      test_partner_id: '',
      test_partner_key: '',
    });
    setEditingApp(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (app: PartnerApp) => {
    setEditingApp(app);
    setFormData({
      partner_id: app.partner_id.toString(),
      partner_key: app.partner_key,
      partner_name: app.partner_name,
      app_category: app.app_category,
      description: app.description || '',
      test_partner_id: app.test_partner_id?.toString() || '',
      test_partner_key: app.test_partner_key || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.partner_id || !formData.partner_key || !formData.partner_name) {
      toast.error('Vui lòng nhập đầy đủ Partner ID, Key và Tên');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        partner_id: Number(formData.partner_id),
        partner_key: formData.partner_key,
        partner_name: formData.partner_name,
        app_category: formData.app_category,
        description: formData.description || null,
        test_partner_id: formData.test_partner_id ? Number(formData.test_partner_id) : null,
        test_partner_key: formData.test_partner_key || null,
      };

      if (editingApp) {
        await updatePartnerApp(editingApp.id, payload);
        toast.success('Cập nhật Partner App thành công');
      } else {
        await createPartnerApp({ ...payload, created_by: authUser?.id });
        toast.success('Tạo Partner App thành công');
      }

      setDialogOpen(false);
      resetForm();
      fetchApps();
    } catch (error) {
      console.error('Error saving partner app:', error);
      toast.error(error instanceof Error ? error.message : 'Lỗi khi lưu Partner App');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!appToDelete) return;

    setDeleting(true);
    try {
      await deletePartnerApp(appToDelete.id);
      toast.success(`Đã xóa ${appToDelete.partner_name}`);
      setDeleteDialogOpen(false);
      setAppToDelete(null);
      fetchApps();
    } catch (error) {
      console.error('Error deleting partner app:', error);
      toast.error('Không thể xóa Partner App');
    } finally {
      setDeleting(false);
    }
  };

  if (!isSystemAdmin) {
    return null;
  }

  const columns = [
    {
      key: 'name',
      header: 'Tên App',
      width: '200px',
      render: (app: PartnerApp) => (
        <div className="flex items-center gap-2">
          <AppWindow className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">{app.partner_name}</p>
            <p className="text-xs text-slate-500">ID: {app.partner_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Loại',
      width: '120px',
      render: (app: PartnerApp) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${APP_CATEGORY_COLORS[app.app_category]}`}>
          {APP_CATEGORY_LABELS[app.app_category]}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      width: '250px',
      hideOnMobile: true,
      render: (app: PartnerApp) => (
        <CellText muted className="text-xs line-clamp-2">{app.description || '-'}</CellText>
      ),
    },
    {
      key: 'test',
      header: 'Test Partner ID',
      width: '140px',
      hideOnMobile: true,
      render: (app: PartnerApp) => (
        <CellText muted>{app.test_partner_id || '-'}</CellText>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '100px',
      render: (app: PartnerApp) => (
        <CellBadge variant={app.is_active ? 'success' : 'default'}>
          {app.is_active ? 'Active' : 'Inactive'}
        </CellBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (app: PartnerApp) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 cursor-pointer"
            onClick={() => openEditDialog(app)}
            title="Chỉnh sửa"
          >
            <Pencil className="w-3.5 h-3.5 text-slate-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 cursor-pointer"
            onClick={() => {
              setAppToDelete(app);
              setDeleteDialogOpen(true);
            }}
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <AppWindow className="w-4 h-4 text-indigo-500" />
            Partner Apps
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý các ứng dụng Shopee Partner (ERP, Ads, ...)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchApps} disabled={loading} className="cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="cursor-pointer">
            <Plus className="w-4 h-4 mr-1" />
            Thêm App
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <SimpleDataTable
          columns={columns}
          data={apps}
          keyExtractor={(app) => app.id}
          loading={loading}
          loadingMessage="Đang tải Partner Apps..."
          emptyMessage="Chưa có Partner App nào"
          emptyDescription="Thêm Partner App để bắt đầu quản lý đa ứng dụng"
        />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingApp ? 'Chỉnh sửa Partner App' : 'Thêm Partner App mới'}</DialogTitle>
            <DialogDescription>
              {editingApp ? 'Cập nhật thông tin Partner App' : 'Nhập thông tin Partner App từ Shopee Open Platform'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner_name">Tên App *</Label>
              <Input
                id="partner_name"
                value={formData.partner_name}
                onChange={(e) => setFormData(prev => ({ ...prev, partner_name: e.target.value }))}
                placeholder="Ví dụ: Betacom Ads"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner_id">Partner ID *</Label>
                <Input
                  id="partner_id"
                  type="number"
                  value={formData.partner_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, partner_id: e.target.value }))}
                  placeholder="2030005"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app_category">Loại App *</Label>
                <Select
                  value={formData.app_category}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, app_category: v as AppCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erp">ERP System</SelectItem>
                    <SelectItem value="ads">Ads Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner_key">Partner Key *</Label>
              <Input
                id="partner_key"
                type="password"
                value={formData.partner_key}
                onChange={(e) => setFormData(prev => ({ ...prev, partner_key: e.target.value }))}
                placeholder="Partner key từ Shopee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả ngắn về app"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test_partner_id">Test Partner ID</Label>
                <Input
                  id="test_partner_id"
                  type="number"
                  value={formData.test_partner_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, test_partner_id: e.target.value }))}
                  placeholder="1216483"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test_partner_key">Test Partner Key</Label>
                <Input
                  id="test_partner_key"
                  type="password"
                  value={formData.test_partner_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, test_partner_key: e.target.value }))}
                  placeholder="Test key"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? 'Đang lưu...' : editingApp ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa Partner App "{appToDelete?.partner_name}"?
              Tất cả tokens liên quan cũng sẽ bị xóa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="cursor-pointer">
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="cursor-pointer">
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
