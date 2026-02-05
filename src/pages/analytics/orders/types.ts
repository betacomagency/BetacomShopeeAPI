/**
 * Shared types for Analytics Orders pages
 *
 * Re-exports types from hook for consistency and adds UI-specific types
 */

import type { AnalyticsDateRange } from '@/components/ui/date-range-picker';

// Re-export types from hook
export type {
  DailyOrderStats as DailyStats,
  DailyCompletedStats,
  OrderValueRange as ValueRange,
  QuantityRangeStats as QuantityRange,
  ProductDetailedStats as ProductItem,
  DailyStatusStats,
  CancelReasonStats as CancelReason,
} from '@/hooks/useOrderReportsOptimized';

// Filter types (UI-specific)
export type OrderTypeFilter = 'created' | 'completed';
export type DisplayMode = 'daily' | 'weekly' | 'monthly';

// Chart data types (UI-specific)
export interface ChartDataPoint {
  date: string;
  displayDate: string;
  revenue: number;
  orders: number;
}

// Tooltip payload types (UI-specific)
export interface ChartDataPayload {
  date: string;
  displayDate: string;
  revenue: number;
  orders: number;
}

export interface TooltipPayloadEntry {
  color?: string;
  name?: string;
  value?: number;
  payload?: ChartDataPayload;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

// Props shared across tabs
export interface BaseTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
}

// Totals interface
export interface Totals {
  created: number;
  completed: number;
  cancelled: number;
}
