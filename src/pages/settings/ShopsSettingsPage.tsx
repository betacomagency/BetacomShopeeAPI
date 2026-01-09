/**
 * Shops Settings Page - Quản lý Shop
 */

import { Store } from 'lucide-react';
import ShopManagementPanel from '@/components/profile/ShopManagementPanel';

export default function ShopsSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
          <Store className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Shop</h1>
          <p className="text-sm text-slate-500">Kết nối và quản lý các shop Shopee</p>
        </div>
      </div>

      {/* Shop Management Panel */}
      <ShopManagementPanel />
    </div>
  );
}
