/**
 * Settings Page - Cài đặt hệ thống với tabs
 */

import { useState } from 'react';
import { Settings, User, Store, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ShopManagementPanel from '@/components/profile/ShopManagementPanel';

type TabKey = 'profile' | 'shops' | 'permissions';

interface Tab {
  key: TabKey;
  title: string;
  icon: typeof User;
}

const tabs: Tab[] = [
  { key: 'profile', title: 'Thông tin cá nhân', icon: User },
  { key: 'shops', title: 'Quản lý Shop', icon: Store },
  { key: 'permissions', title: 'Phân quyền Shop', icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const { user, profile } = useAuth();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cài đặt</h1>
          <p className="text-sm text-slate-500">Quản lý thông tin và cài đặt hệ thống</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200">
          <nav className="flex gap-1 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.title}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && <ProfileTab user={user} profile={profile} />}
          {activeTab === 'shops' && <ShopsTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user, profile }: { user: any; profile: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Thông tin cá nhân</h3>
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
              defaultValue={profile?.company || ''}
              placeholder="Nhập tên công ty"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}

function ShopsTab() {
  return <ShopManagementPanel />;
}

function PermissionsTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Phân quyền Shop</h3>
        <p className="text-sm text-slate-500">
          Quản lý quyền truy cập và thao tác cho từng shop
        </p>
      </div>
      <div className="bg-slate-50 rounded-lg p-8 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Tính năng đang được phát triển</p>
        <p className="text-sm text-slate-400 mt-1">
          Bạn sẽ có thể phân quyền cho từng thành viên truy cập các shop khác nhau
        </p>
      </div>
    </div>
  );
}
