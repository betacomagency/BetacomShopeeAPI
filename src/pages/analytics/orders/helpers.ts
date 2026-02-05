/**
 * Helper functions for Analytics Orders pages
 */

import type { AnalyticsDateRange } from '@/components/ui/date-range-picker';

/**
 * Format number with Vietnamese locale
 * Returns '0' for NaN, undefined, or null values
 */
export function formatNumber(num: number): string {
  if (num === undefined || num === null || Number.isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

/**
 * Format currency with abbreviated suffixes (K, M, B)
 */
export function formatCurrency(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

/**
 * Format date string to DD/MM format
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * Get default date range (current month)
 */
export function getDefaultDateRange(): AnalyticsDateRange {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: firstDay, to: lastDay };
}

/**
 * Calculate nice Y-axis scale for revenue
 */
export function calculateRevenueScale(data: { revenue: number }[]): {
  maxRevenue: number;
  revenueTicks: number[];
} {
  const max = Math.max(...data.map((d) => d.revenue), 0);
  if (max === 0) {
    return { maxRevenue: 1000000, revenueTicks: [0, 250000, 500000, 750000, 1000000] };
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  let niceMax: number;

  if (normalized <= 1) niceMax = magnitude;
  else if (normalized <= 1.5) niceMax = 1.5 * magnitude;
  else if (normalized <= 2) niceMax = 2 * magnitude;
  else if (normalized <= 3) niceMax = 3 * magnitude;
  else if (normalized <= 5) niceMax = 5 * magnitude;
  else niceMax = 10 * magnitude;

  const step = niceMax / 4;
  const ticks = [0, step, step * 2, step * 3, niceMax];

  return { maxRevenue: niceMax, revenueTicks: ticks };
}

/**
 * Calculate nice Y-axis scale for orders
 */
export function calculateOrdersScale(data: { orders: number }[]): {
  maxOrders: number;
  ordersTicks: number[];
} {
  const max = Math.max(...data.map((d) => d.orders), 0);
  if (max === 0) {
    return { maxOrders: 100, ordersTicks: [0, 25, 50, 75, 100] };
  }

  let niceMax: number;
  if (max <= 10) niceMax = 10;
  else if (max <= 20) niceMax = 20;
  else if (max <= 50) niceMax = 50;
  else if (max <= 100) niceMax = 100;
  else if (max <= 200) niceMax = 200;
  else if (max <= 500) niceMax = 500;
  else niceMax = Math.ceil(max / 100) * 100;

  const step = niceMax / 4;
  const ticks = [0, step, step * 2, step * 3, niceMax];
  return { maxOrders: niceMax, ordersTicks: ticks };
}
