/**
 * Menu Configuration - Single source of truth cho menu items và permissions
 * 
 * Khi thêm menu mới, chỉ cần thêm vào đây và cả Sidebar lẫn Permission Dialog
 * sẽ tự động cập nhật.
 */

import {
  Home,
  Settings,
  User,
  Zap,
  Package,
  Clock,
  TrendingUp,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';

export interface MenuChildItem {
  title: string;
  icon: LucideIcon;
  path: string;
  permissionKey?: string;
}

export interface MenuItem {
  title: string;
  icon: LucideIcon;
  path?: string;
  permissionKey?: string; // Key để check permission
  description?: string; // Mô tả cho dialog phân quyền
  openInNewTab?: boolean; // Mở trong tab mới
  children?: MenuChildItem[];
}

/**
 * Menu items configuration
 * - permissionKey: dùng để check quyền truy cập (via usePermissionsContext)
 * - description: hiển thị trong dialog phân quyền
 */
export const menuItems: MenuItem[] = [
  {
    title: 'Trang chủ',
    icon: Home,
    path: '/dashboard',
    permissionKey: 'home',
    description: 'Xem tổng quan hệ thống',
  },
  {
    title: 'Sản phẩm',
    icon: Package,
    permissionKey: 'products',
    description: 'Quản lý sản phẩm',
    children: [
      { title: 'Danh sách sản phẩm', icon: Package, path: '/products', permissionKey: 'products' },
    ],
  },
  {
    title: 'Flash Sale',
    icon: Zap,
    permissionKey: 'flash-sale',
    description: 'Quản lý Flash Sale',
    children: [
      { title: 'Danh sách', icon: Zap, path: '/flash-sale', permissionKey: 'flash-sale' },
      { title: 'Lịch sử', icon: Clock, path: '/flash-sale/auto-setup', permissionKey: 'flash-sale' },
    ],
  },
  {
    title: 'Quảng cáo',
    icon: Megaphone,
    path: '/ads',
    permissionKey: 'ads',
    description: 'Quản lý chiến dịch quảng cáo Shopee Ads',
  },
  {
    title: 'Hiệu quả bán hàng',
    icon: TrendingUp,
    path: '/shop-performance',
    permissionKey: 'shop-performance',
    description: 'Xem chỉ số hiệu quả bán hàng từ Shopee Account Health',
  },
  {
    title: 'Cài đặt',
    icon: Settings,
    children: [
      {
        title: 'Thông tin cá nhân',
        icon: User,
        path: '/settings/profile',
        permissionKey: 'settings/profile'
      },
    ],
  },
];

export interface FeaturePermission {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  group?: string;
}

/**
 * Tự động generate danh sách permissions từ menuItems
 * Hàm này đảm bảo permission dialog luôn đồng bộ với sidebar
 */
export function getFeaturePermissions(): FeaturePermission[] {
  const permissions: FeaturePermission[] = [];

  menuItems.forEach((item) => {
    // Menu cha không có children
    if (!item.children && item.permissionKey) {
      permissions.push({
        key: item.permissionKey,
        label: item.title,
        icon: item.icon,
        description: item.description || `Truy cập ${item.title}`,
      });
    }

    // Menu cha có children
    if (item.children) {
      if (item.permissionKey) {
        permissions.push({
          key: item.permissionKey,
          label: item.title,
          icon: item.icon,
          description: item.description || `Truy cập ${item.title}`,
        });
      }

      // Thêm các children thuộc group Cài đặt (vì có permission riêng)
      if (item.title === 'Cài đặt') {
        item.children.forEach((child) => {
          if (child.permissionKey) {
            permissions.push({
              key: child.permissionKey,
              label: child.title,
              icon: child.icon,
              description: `Truy cập ${child.title}`,
              group: 'Cài đặt',
            });
          }
        });
      }
    }
  });

  return permissions;
}
