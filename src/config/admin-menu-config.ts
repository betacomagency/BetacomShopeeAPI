/**
 * Admin Menu Configuration - Menu items cho Admin Panel sidebar
 */

import {
  LayoutDashboard,
  Zap,
  Activity,
  Store,
  Users,
  Heart,
  BarChart3,
  Search,
  type LucideIcon,
} from 'lucide-react';

export interface AdminMenuItem {
  title: string;
  icon: LucideIcon;
  path: string;
  children?: AdminMenuItem[];
}

export const adminMenuItems: AdminMenuItem[] = [
  { title: 'Tổng quan', icon: LayoutDashboard, path: '/admin' },
  { title: 'Flash Sale', icon: Zap, path: '/admin/flash-sale' },
  { title: 'API Call Logs', icon: Activity, path: '/admin/api-logs' },
  { title: 'Quản lý Shop', icon: Store, path: '/admin/shops' },
  { title: 'Quản lý người dùng', icon: Users, path: '/admin/users' },
  {
    title: 'Monitoring', icon: Heart, path: '/admin/monitoring',
    children: [
      { title: 'Health', icon: Heart, path: '/admin/monitoring' },
      { title: 'API Analytics', icon: BarChart3, path: '/admin/monitoring/api' },
      { title: 'Business', icon: Activity, path: '/admin/monitoring/business' },
      { title: 'User Activity', icon: Users, path: '/admin/monitoring/activity' },
      { title: 'Request Trace', icon: Search, path: '/admin/monitoring/trace' },
    ],
  },
];
