/**
 * useDashboardData - Hook for dashboard statistics
 * Aggregates order data by date and provides comparison with previous period
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ==================== INTERFACES ====================

export type DateRangeOption = 'today' | 'yesterday' | '7days' | '14days' | '30days' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

export interface DailyStats {
  date: string; // YYYY-MM-DD
  orderCount: number;
  revenue: number;
  completedOrders: number;
  cancelledOrders: number;
}

export interface ChannelStats {
  channel: string;
  revenue: number;
  revenueChange: number; // percentage change vs previous period
  revenuePercent: number; // percentage of total
  orderCount: number;
  orderCountChange: number;
  orderPercent: number;
  avgOrderValue: number; // GTTB
  avgOrderValueChange: number;
  profit: number;
  profitChange: number;
  profitPercent: number; // %DT
}

export interface DashboardStats {
  // Summary row
  totalRevenue: number;
  totalRevenueChange: number;
  totalOrders: number;
  totalOrdersChange: number;
  avgOrderValue: number;
  avgOrderValueChange: number;
  totalProfit: number;
  totalProfitChange: number;

  // By channel
  channels: ChannelStats[];

  // Daily breakdown for chart
  dailyStats: DailyStats[];
}

export interface UseDashboardDataReturn {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Date range helpers
function getDateRange(option: DateRangeOption): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let start: Date;
  let end: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (option) {
    case 'today': {
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      // Previous: yesterday
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'yesterday': {
      end = new Date(today);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setHours(0, 0, 0, 0);
      // Previous: day before yesterday
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case '7days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      // Previous 7 days
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case '14days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 13);
      start.setHours(0, 0, 0, 0);
      // Previous 14 days
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 13);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case '30days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      // Previous 30 days
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 29);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_week': {
      // Start from Monday of current week
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(today);
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      // Previous: last week
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
    case 'last_week': {
      // Last week Monday to Sunday
      const dayOfWeek2 = today.getDay();
      const diffToMonday2 = dayOfWeek2 === 0 ? 6 : dayOfWeek2 - 1;
      end = new Date(today);
      end.setDate(end.getDate() - diffToMonday2 - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      // Previous: week before last
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      // Previous: last month
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      // Previous: month before last
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      break;
    }
    default: {
      // Default to 14 days
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 13);
      start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 13);
      prevStart.setHours(0, 0, 0, 0);
    }
  }

  return { start, end, prevStart, prevEnd };
}

function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// Format date as YYYY-MM-DD in local timezone (NOT UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// Default empty stats
const DEFAULT_STATS: DashboardStats = {
  totalRevenue: 0,
  totalRevenueChange: 0,
  totalOrders: 0,
  totalOrdersChange: 0,
  avgOrderValue: 0,
  avgOrderValueChange: 0,
  totalProfit: 0,
  totalProfitChange: 0,
  channels: [],
  dailyStats: [],
};

/**
 * Hook for dashboard data
 */
export function useDashboardData(
  shopId: number,
  userId: string,
  dateRange: DateRangeOption = '14days'
): UseDashboardDataReturn {
  const queryKey = useMemo(() => ['dashboard', shopId, userId, dateRange], [shopId, userId, dateRange]);

  const fetchDashboardStats = useCallback(async (): Promise<DashboardStats> => {
    if (!shopId || !userId) return DEFAULT_STATS;

    const { start, end, prevStart, prevEnd } = getDateRange(dateRange);
    const startTs = toUnixTimestamp(start);
    const endTs = toUnixTimestamp(end);
    const prevStartTs = toUnixTimestamp(prevStart);
    const prevEndTs = toUnixTimestamp(prevEnd);

    // Use RPC functions to aggregate data directly in database (avoids row limit issues)
    // Fetch daily stats using RPC function
    const { data: dailyData, error: dailyError } = await supabase
      .rpc('get_dashboard_daily_stats', {
        p_shop_id: shopId,
        p_start_ts: startTs,
        p_end_ts: endTs
      });

    if (dailyError) {
      console.error('[useDashboardData] Error fetching daily stats:', dailyError);
      throw new Error(dailyError.message);
    }

    // Fetch current period totals
    const { data: currentTotals, error: currentError } = await supabase
      .rpc('get_dashboard_period_totals', {
        p_shop_id: shopId,
        p_start_ts: startTs,
        p_end_ts: endTs
      });

    if (currentError) {
      console.error('[useDashboardData] Error fetching current totals:', currentError);
      throw new Error(currentError.message);
    }

    // Fetch previous period totals for comparison
    const { data: prevTotals, error: prevError } = await supabase
      .rpc('get_dashboard_period_totals', {
        p_shop_id: shopId,
        p_start_ts: prevStartTs,
        p_end_ts: prevEndTs
      });

    if (prevError) {
      console.error('[useDashboardData] Error fetching previous totals:', prevError);
    }

    // Process daily stats from RPC result
    const dailyMap = new Map<string, DailyStats>();

    // Initialize all dates in range (using local timezone)
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = formatLocalDate(currentDate);
      dailyMap.set(dateStr, {
        date: dateStr,
        orderCount: 0,
        revenue: 0,
        completedOrders: 0,
        cancelledOrders: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate with actual data from RPC
    (dailyData || []).forEach((row: {
      order_date: string;
      order_count: number;
      revenue: number;
      completed_orders: number;
      cancelled_orders: number;
    }) => {
      const dateStr = row.order_date; // Already in YYYY-MM-DD format
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.orderCount = Number(row.order_count);
        existing.revenue = Number(row.revenue);
        existing.completedOrders = Number(row.completed_orders);
        existing.cancelledOrders = Number(row.cancelled_orders);
      }
    });

    const dailyStats = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Get totals from RPC results
    const currentRevenue = currentTotals?.[0]?.total_revenue ? Number(currentTotals[0].total_revenue) : 0;
    const currentOrderCount = currentTotals?.[0]?.total_orders ? Number(currentTotals[0].total_orders) : 0;
    const prevRevenue = prevTotals?.[0]?.total_revenue ? Number(prevTotals[0].total_revenue) : 0;
    const prevOrderCount = prevTotals?.[0]?.total_orders ? Number(prevTotals[0].total_orders) : 0;

    const currentAvgOrder = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;
    const prevAvgOrder = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

    // Estimate profit at ~48% of revenue (typical e-commerce margin)
    const profitMargin = 0.48;
    const currentProfit = currentRevenue * profitMargin;
    const prevProfit = prevRevenue * profitMargin;

    // Channel stats (currently only Shopee)
    const channels: ChannelStats[] = [
      {
        channel: 'Shopee',
        revenue: currentRevenue,
        revenueChange: calculateChange(currentRevenue, prevRevenue),
        revenuePercent: 100,
        orderCount: currentOrderCount,
        orderCountChange: calculateChange(currentOrderCount, prevOrderCount),
        orderPercent: 100,
        avgOrderValue: Math.round(currentAvgOrder),
        avgOrderValueChange: calculateChange(currentAvgOrder, prevAvgOrder),
        profit: Math.round(currentProfit),
        profitChange: calculateChange(currentProfit, prevProfit),
        profitPercent: Math.round((currentProfit / currentRevenue) * 100) || 0,
      },
    ];

    return {
      totalRevenue: currentRevenue,
      totalRevenueChange: calculateChange(currentRevenue, prevRevenue),
      totalOrders: currentOrderCount,
      totalOrdersChange: calculateChange(currentOrderCount, prevOrderCount),
      avgOrderValue: Math.round(currentAvgOrder),
      avgOrderValueChange: calculateChange(currentAvgOrder, prevAvgOrder),
      totalProfit: Math.round(currentProfit),
      totalProfitChange: calculateChange(currentProfit, prevProfit),
      channels,
      dailyStats,
    };
  }, [shopId, userId, dateRange]);

  const { data, isLoading, error, refetch: queryRefetch } = useQuery({
    queryKey,
    queryFn: fetchDashboardStats,
    enabled: !!shopId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    stats: data || null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

// Date range label mapping - organized in 3 columns for UI
export const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  '7days': '7 ngày',
  '14days': '14 ngày',
  '30days': '30 ngày',
  this_week: 'Tuần này',
  last_week: 'Tuần trước',
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
};

// Grouped for 3-column layout
export const DATE_RANGE_GROUPS: DateRangeOption[][] = [
  ['yesterday', 'today', '7 ngày' as unknown as DateRangeOption].filter(Boolean) as DateRangeOption[],
  ['last_week', 'this_week', '14days'],
  ['last_month', 'this_month', '30days'],
];

// Actual groups for UI
export const DATE_RANGE_COLUMNS = [
  ['yesterday', 'last_week', 'last_month'] as DateRangeOption[],
  ['today', 'this_week', 'this_month'] as DateRangeOption[],
  ['7days', '14days', '30days'] as DateRangeOption[],
];
