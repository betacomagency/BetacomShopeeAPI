/**
 * Constants for Analytics Orders pages
 */

import {
  ShoppingCart,
  CheckCircle,
  Banknote,
  Package,
  Activity,
  XCircle,
} from 'lucide-react';
import type { OrderReportTab } from '@/hooks/useOrderReportsOptimized';
import type { OrderTypeFilter, DisplayMode } from './types';

// Filter options
export const ORDER_TYPE_OPTIONS: { value: OrderTypeFilter; label: string }[] = [
  { value: 'created', label: 'Ngày tạo' },
  { value: 'completed', label: 'Ngày hoàn thành' },
];

export const DISPLAY_MODE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: 'daily', label: 'Theo ngày' },
  { value: 'weekly', label: 'Theo tuần' },
  { value: 'monthly', label: 'Theo tháng' },
];

// Chart colors
export const COLORS = [
  '#F97316',
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
];

// Tab configuration
export const TABS: { id: OrderReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'created', label: 'Đơn tạo', icon: ShoppingCart },
  { id: 'completed', label: 'Đơn thành công', icon: CheckCircle },
  { id: 'value', label: 'Theo giá trị đơn hàng', icon: Banknote },
  { id: 'product', label: 'Theo sản phẩm', icon: Package },
  { id: 'status', label: 'Theo trạng thái', icon: Activity },
  { id: 'cancel', label: 'Lý do khách hủy', icon: XCircle },
];
