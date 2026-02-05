/**
 * InventorySummary - Card showing inventory statistics
 */

import { Package, DollarSign, Tag } from 'lucide-react';
import type { InventorySummary as InventorySummaryType } from '@/hooks/useInventorySummary';

interface InventorySummaryProps {
  summary: InventorySummaryType;
  loading?: boolean;
}

// Format number with Vietnamese locale
function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

export function InventorySummary({ summary, loading }: InventorySummaryProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded w-20 animate-pulse" />
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: Package,
      label: 'Số lượng tồn',
      value: formatNumber(summary.totalQuantity),
      color: 'text-blue-500 bg-blue-50',
    },
    {
      icon: DollarSign,
      label: 'Giá trị tồn theo giá vốn',
      value: summary.totalValueAtCost !== null ? formatNumber(summary.totalValueAtCost) : '-',
      color: 'text-emerald-500 bg-emerald-50',
    },
    {
      icon: Tag,
      label: 'Giá trị tồn theo giá bán',
      value: formatNumber(summary.totalValueAtSelling),
      color: 'text-orange-500 bg-orange-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-800">Tồn kho</h2>
      </div>

      {/* Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50"
              >
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-lg font-semibold text-slate-800">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
