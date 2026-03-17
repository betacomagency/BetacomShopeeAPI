/**
 * Profile Settings Page - Danh sách shop của user
 */

import { ShopManagementPanel } from '@/components/profile/ShopManagementPanel';

export default function ProfileSettingsPage() {
  return (
    <div className="p-6">
      <ShopManagementPanel readOnly />
    </div>
  );
}
