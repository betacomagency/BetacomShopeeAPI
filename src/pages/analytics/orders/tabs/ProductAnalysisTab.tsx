/**
 * Product Analysis Tab - Theo sản phẩm
 */

import { Package, Search, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AnalyticsDateRangePicker, type AnalyticsDateRange } from '@/components/ui/date-range-picker';

import { Pagination } from '../components';
import { formatNumber } from '../helpers';
import type { ProductItem } from '../types';

type ProductSortType = 'quantity' | 'name' | 'completed' | 'cancelled';

interface ProductAnalysisTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
  productItems: ProductItem[];
  productTotal: number;
  productTotalPages: number;
  productPage: number;
  setProductPage: (page: number) => void;
  productSearch: string;
  setProductSearch: (search: string) => void;
  productSort: ProductSortType;
  setProductSort: (sort: ProductSortType) => void;
}

export function ProductAnalysisTab({
  dateRange,
  onDateRangeChange,
  loading,
  productItems,
  productTotal,
  productTotalPages,
  productPage,
  setProductPage,
  productSearch,
  setProductSearch,
  productSort,
  setProductSort,
}: ProductAnalysisTabProps) {
  // Height = viewport - breadcrumb(73px) - page padding(32px) - tabs(44px) - tab content margin(16px) - page bottom padding(16px)
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 181px)' }}>
      {/* Filter bar */}
      <Card className="mb-4 flex-shrink-0">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <AnalyticsDateRangePicker value={dateRange} onChange={onDateRangeChange} />

            {/* Search */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Tìm kiếm</div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm sản phẩm..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPage(1); // Reset to first page on search
                  }}
                  className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Sort */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Sắp xếp</div>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4 text-slate-400" />
                <select
                  value={productSort}
                  onChange={(e) => setProductSort(e.target.value as ProductSortType)}
                  className="px-2 py-2 text-sm border border-slate-200 rounded-md bg-white cursor-pointer"
                >
                  <option value="quantity">SL đặt hàng</option>
                  <option value="completed">SL thành công</option>
                  <option value="cancelled">Tỷ lệ hủy</option>
                  <option value="name">Tên A-Z</option>
                </select>
              </div>
            </div>

            <div className="flex-1" />
            <div className="text-sm text-slate-500 pb-2">
              Tổng: <span className="font-medium text-blue-600">{formatNumber(productTotal)}</span> SP
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card - fills remaining height */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner className="w-8 h-8" />
            </div>
          ) : productItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              {productSearch ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có dữ liệu'}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto border border-slate-200 rounded-lg min-h-0">
                <table className="w-full text-sm border-collapse whitespace-nowrap">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      <th
                        rowSpan={2}
                        className="px-2 py-2 text-left font-medium text-slate-600 border-r border-slate-200 bg-slate-50 min-w-[200px]"
                      >
                        Sản phẩm
                      </th>
                      <th rowSpan={2} className="px-2 py-2 text-right font-medium text-slate-600 border-r border-slate-200 bg-slate-50">
                        Giá
                      </th>
                      <th colSpan={2} className="px-2 py-2 text-center font-medium text-blue-600 border-r border-slate-200 bg-blue-50">
                        Đặt hàng
                      </th>
                      <th colSpan={2} className="px-2 py-2 text-center font-medium text-green-600 border-r border-slate-200 bg-green-50">
                        Thành công
                      </th>
                      <th colSpan={2} className="px-2 py-2 text-center font-medium text-red-600 bg-red-50">
                        Hủy
                      </th>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-blue-50">Đơn</th>
                      <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-blue-50">
                        SP
                      </th>
                      <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-green-50">SP</th>
                      <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-green-50">
                        %
                      </th>
                      <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-red-50">SP</th>
                      <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-red-50">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productItems.map((product) => (
                      <tr key={product.itemId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.itemName}
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <span className="truncate max-w-[180px]" title={product.itemName}>
                              {product.itemName}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right border-r border-slate-200">{formatNumber(product.price)}</td>
                        <td className="px-2 py-2 text-center text-blue-600">{formatNumber(product.ordersCount)}</td>
                        <td className="px-2 py-2 text-center text-blue-600 border-r border-slate-200">
                          {formatNumber(product.ordersSP)}
                        </td>
                        <td className="px-2 py-2 text-center text-green-600">
                          {product.completedSP > 0 ? formatNumber(product.completedSP) : '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-green-600 border-r border-slate-200">
                          {product.completedPercent > 0 ? product.completedPercent.toFixed(1) + '%' : '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-red-600">
                          {product.cancelledSP > 0 ? formatNumber(product.cancelledSP) : '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-red-600">
                          {product.cancelledPercent > 0 ? product.cancelledPercent.toFixed(1) + '%' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex-shrink-0 pt-2">
                <Pagination page={productPage} totalPages={productTotalPages} onPageChange={setProductPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
