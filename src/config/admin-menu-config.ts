/**
 * Admin Menu Configuration - Menu items cho Admin Panel sidebar
 */

import {
  LayoutDashboard,
  Zap,
  Activity,
  Layers,
  Bell,
  History,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AdminMenuItem {
  title: string;
  icon: LucideIcon;
  path: string;
}

export const adminMenuItems: AdminMenuItem[] = [
  { title: 'Tổng quan', icon: LayoutDashboard, path: '/admin' },
  { title: 'Flash Sale', icon: Zap, path: '/admin/flash-sale' },
  { title: 'API Call Logs', icon: Activity, path: '/admin/api-logs' },
  { title: 'API Registry', icon: Layers, path: '/admin/api-registry' },
  { title: 'Push Logs', icon: Bell, path: '/admin/push-logs' },
  { title: 'Lịch sử thao tác', icon: History, path: '/admin/activity' },
  { title: 'Quản lý Shop', icon: Store, path: '/admin/shops' },
  { title: 'Quản lý người dùng', icon: Users, path: '/admin/users' },
];
