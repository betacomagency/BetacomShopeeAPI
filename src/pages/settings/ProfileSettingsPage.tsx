/**
 * Profile Settings Page - Thông tin cá nhân
 * Hiển thị thông tin tài khoản, đổi mật khẩu và danh sách shop
 */

import ShopManagementPanel from '@/components/profile/ShopManagementPanel';
import UserProfilePanel from '@/components/profile/UserProfilePanel';

export default function ProfileSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* User Info & Password Change */}
      <UserProfilePanel />
      
      {/* Shop Management Panel - Chế độ chỉ xem */}
      <ShopManagementPanel readOnly />
    </div>
  );
}
