/**
 * Profile Settings Page - Thông tin cá nhân
 */

import { Settings, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfileSettingsPage() {
  const { user, profile } = useAuth();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Thông tin cá nhân</h1>
          <p className="text-sm text-slate-500">Quản lý thông tin tài khoản của bạn</p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Họ và tên
              </label>
              <Input
                defaultValue={profile?.full_name || ''}
                placeholder="Nhập họ và tên"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Số điện thoại
              </label>
              <Input
                defaultValue={profile?.phone || ''}
                placeholder="Nhập số điện thoại"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Công ty
              </label>
              <Input
                placeholder="Nhập tên công ty"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
