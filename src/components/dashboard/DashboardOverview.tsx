/**
 * DashboardOverview - Overview table showing sales metrics by channel
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardStats, DateRangeOption } from '@/hooks/useDashboardData';
import { DATE_RANGE_LABELS, DATE_RANGE_COLUMNS } from '@/hooks/useDashboardData';

interface DashboardOverviewProps {
  stats: DashboardStats | null;
  loading?: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

// Format number with Vietnamese locale
function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

// Format percentage change with color
function ChangeCell({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const displayValue = `${isPositive ? '+' : ''}${value}%`;

  return (
    <span
      className={cn(
        'text-sm font-medium',
        isPositive && 'text-emerald-600',
        isNegative && 'text-red-500',
        !isPositive && !isNegative && 'text-slate-500'
      )}
    >
      {displayValue}
    </span>
  );
}

// Percentage cell
function PercentCell({ value }: { value: number }) {
  return <span className="text-sm text-slate-600">{value}%</span>;
}

// Shopee icon
function ShopeeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#EE4D2D">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
  );
}

// Date Range Dropdown with 3 columns
function DateRangeDropdown({
  value,
  onChange,
}: {
  value: DateRangeOption;
  onChange: (range: DateRangeOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer min-w-[100px]"
      >
        <span className="text-slate-600">{DATE_RANGE_LABELS[value]}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-20">
            <div className="flex gap-1">
              {DATE_RANGE_COLUMNS.map((column, colIdx) => (
                <div key={colIdx} className="flex flex-col">
                  {column.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        onChange(option);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'px-3 py-1.5 text-sm text-left rounded hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap',
                        value === option && 'bg-orange-50 text-orange-600 font-medium'
                      )}
                    >
                      {DATE_RANGE_LABELS[option]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardOverview({
  stats,
  loading,
  dateRange,
  onDateRangeChange,
}: DashboardOverviewProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-100 rounded w-24 animate-pulse" />
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const columns = [
    { key: 'channel', label: 'Kênh bán', width: 'w-32' },
    { key: 'revenue', label: 'Doanh thu', width: 'w-32' },
    { key: 'revenuePercent', label: '', width: 'w-16' },
    { key: 'orders', label: 'Số đơn', width: 'w-24' },
    { key: 'ordersPercent', label: '', width: 'w-16' },
    { key: 'avgOrder', label: 'GTTB', width: 'w-24' },
    { key: 'profit', label: 'Lợi nhuận', width: 'w-28' },
    { key: 'profitDT', label: '%DT', width: 'w-16' },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Tổng quan</h2>
        <DateRangeDropdown value={dateRange} onChange={onDateRangeChange} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider',
                    col.width
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Summary Row */}
            <tr className="bg-slate-50/30 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Đơn hàng</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <ChangeCell value={stats.totalRevenueChange} />
                  <span className="text-sm font-semibold text-slate-800">
                    {formatNumber(stats.totalRevenue)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <PercentCell value={100} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <ChangeCell value={stats.totalOrdersChange} />
                  <span className="text-sm font-semibold text-slate-800">
                    {formatNumber(stats.totalOrders)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <PercentCell value={100} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <ChangeCell value={stats.avgOrderValueChange} />
                  <span className="text-sm font-semibold text-slate-800">
                    {formatNumber(stats.avgOrderValue)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <ChangeCell value={stats.totalProfitChange} />
                  <span className="text-sm font-semibold text-slate-800">
                    {formatNumber(stats.totalProfit)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">48%</span>
              </td>
            </tr>

            {/* Channel Rows */}
            {stats.channels.map((channel) => (
              <tr key={channel.channel} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {channel.channel === 'Shopee' && <ShopeeIcon />}
                    <span className="text-sm text-slate-600">{channel.channel}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <ChangeCell value={channel.revenueChange} />
                    <span className="text-sm text-slate-700">
                      {formatNumber(channel.revenue)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PercentCell value={channel.revenuePercent} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <ChangeCell value={channel.orderCountChange} />
                    <span className="text-sm text-slate-700">
                      {formatNumber(channel.orderCount)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PercentCell value={channel.orderPercent} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <ChangeCell value={channel.avgOrderValueChange} />
                    <span className="text-sm text-slate-700">
                      {formatNumber(channel.avgOrderValue)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <ChangeCell value={channel.profitChange} />
                    <span className="text-sm text-slate-700">
                      {formatNumber(channel.profit)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-700">{channel.profitPercent}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
