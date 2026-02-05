/**
 * BestSellingProducts - Table showing top selling products
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BestSellingProduct, TopLimitOption } from '@/hooks/useBestSellingProducts';
import { TOP_LIMIT_OPTIONS, TOP_LIMIT_LABELS } from '@/hooks/useBestSellingProducts';
import type { DateRangeOption } from '@/hooks/useDashboardData';
import { DATE_RANGE_LABELS, DATE_RANGE_COLUMNS } from '@/hooks/useDashboardData';

interface BestSellingProductsProps {
  products: BestSellingProduct[];
  loading?: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
  topLimit: TopLimitOption;
  onTopLimitChange: (limit: TopLimitOption) => void;
}

// Format number with Vietnamese locale
function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
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

// Top Limit Dropdown
function TopLimitDropdown({
  value,
  onChange,
}: {
  value: TopLimitOption;
  onChange: (limit: TopLimitOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer min-w-[90px]"
      >
        <span className="text-slate-600">{TOP_LIMIT_LABELS[value]}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[90px]">
            {TOP_LIMIT_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer',
                  value === option && 'bg-orange-50 text-orange-600 font-medium'
                )}
              >
                {TOP_LIMIT_LABELS[option]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BestSellingProducts({
  products,
  loading,
  dateRange,
  onDateRangeChange,
  topLimit,
  onTopLimitChange,
}: BestSellingProductsProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="h-6 bg-slate-100 rounded w-40 animate-pulse" />
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Sản phẩm bán chạy</h2>
        <div className="flex items-center gap-2">
          <DateRangeDropdown value={dateRange} onChange={onDateRangeChange} />
          <TopLimitDropdown value={topLimit} onChange={onTopLimitChange} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Tên sản phẩm
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                SL bán
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                SL trả
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                Doanh thu
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={`${product.itemId}-${product.modelId}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {product.rank}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700">
                      {product.modelSku && (
                        <span className="text-slate-500">[{product.modelSku}] </span>
                      )}
                      {product.itemName}
                      {product.modelName && (
                        <span className="text-slate-500"> - {product.modelName}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {formatNumber(product.quantitySold)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {product.quantityReturned > 0 ? (
                      <span className="text-red-500">{formatNumber(product.quantityReturned)}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-800">
                    {formatNumber(product.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
