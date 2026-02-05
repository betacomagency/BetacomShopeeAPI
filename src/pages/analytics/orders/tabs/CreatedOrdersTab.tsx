/**
 * Created Orders Tab - Đơn tạo
 */

import { useMemo, useState, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnalyticsDateRangePicker, type AnalyticsDateRange } from '@/components/ui/date-range-picker';

import { Dropdown, CustomTooltip } from '../components';
import { ORDER_TYPE_OPTIONS, DISPLAY_MODE_OPTIONS } from '../constants';
import { formatNumber, formatDate, formatCurrency, calculateRevenueScale, calculateOrdersScale } from '../helpers';
import type { OrderTypeFilter, DisplayMode, DailyStats, ChartDataPoint } from '../types';

interface CreatedOrdersTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
  dailyStats: DailyStats[];
}

export function CreatedOrdersTab({
  dateRange,
  onDateRangeChange,
  loading,
  dailyStats,
}: CreatedOrdersTabProps) {
  const [orderType, setOrderType] = useState<OrderTypeFilter>('created');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('daily');
  const [hoveredSeries, setHoveredSeries] = useState<'revenue' | 'orders' | null>(null);

  // Transform data for chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!dailyStats.length) return [];
    return dailyStats.map((day) => ({
      date: day.date,
      displayDate: formatDate(day.date),
      revenue: day.createdRevenue,
      orders: day.created,
    }));
  }, [dailyStats]);

  // Calculate Y-axis scales
  const { maxRevenue, revenueTicks } = useMemo(() => calculateRevenueScale(chartData), [chartData]);
  const { maxOrders, ordersTicks } = useMemo(() => calculateOrdersScale(chartData), [chartData]);

  // Handlers
  const handleMouseEnterBar = useCallback(() => setHoveredSeries('revenue'), []);
  const handleMouseEnterLine = useCallback(() => setHoveredSeries('orders'), []);
  const handleMouseLeave = useCallback(() => setHoveredSeries(null), []);

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-slate-100">
            <AnalyticsDateRangePicker value={dateRange} onChange={onDateRangeChange} />
            <Dropdown label="Loại" value={orderType} options={ORDER_TYPE_OPTIONS} onChange={setOrderType} />
            <Dropdown label="Hiển thị" value={displayMode} options={DISPLAY_MODE_OPTIONS} onChange={setDisplayMode} />
            <div className="flex-1" />
            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
              <Filter className="w-4 h-4 mr-1" />
              Lọc
            </Button>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="h-[320px] flex items-center justify-center">
              <Spinner className="w-8 h-8" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-slate-400">
              Chưa có dữ liệu
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }} onMouseLeave={handleMouseLeave}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={5} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={formatCurrency} domain={[0, maxRevenue]} ticks={revenueTicks} width={50} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} domain={[0, maxOrders]} ticks={ordersTicks} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                <Legend verticalAlign="bottom" height={24} iconType="circle" />
                <Bar yAxisId="left" dataKey="revenue" fill={hoveredSeries === 'orders' ? 'rgba(59, 130, 246, 0.3)' : '#3B82F6'} radius={[2, 2, 0, 0]} maxBarSize={28} name="Doanh thu" onMouseEnter={handleMouseEnterBar} onMouseLeave={handleMouseLeave} />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke={hoveredSeries === 'revenue' ? 'rgba(239, 68, 68, 0.3)' : '#EF4444'} strokeWidth={2} dot={{ fill: '#EF4444', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: '#EF4444' }} name="Đơn" onMouseEnter={handleMouseEnterLine} onMouseLeave={handleMouseLeave} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Daily Stats Table */}
      {!loading && dailyStats.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="overflow-auto max-h-[calc(100vh-200px)] border border-slate-200 rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200">
                    <th rowSpan={2} className="px-2 py-2 text-left font-medium text-slate-600 border-r border-slate-200 bg-slate-50"></th>
                    <th colSpan={6} className="px-2 py-2 text-center font-medium text-slate-700 border-r border-slate-200 bg-slate-50">
                      Đơn hàng tạo theo ngày
                    </th>
                    <th colSpan={7} className="px-2 py-2 text-center font-medium text-slate-700 bg-slate-50">
                      Đơn tạo theo ngày đã thành công
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Đơn</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">SLSP</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Phí trả HVC</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Doanh thu</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">TB</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-slate-50">Lợi nhuận</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Đơn</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">SLSP</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Phí trả HVC</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Phí ship báo khách</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Doanh thu</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">Lợi nhuận</th>
                    <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-50">CVR (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Summary row */}
                  <tr className="border-b border-slate-200 bg-blue-50 font-medium">
                    <td className="px-2 py-2 text-slate-700 border-r border-slate-200 bg-blue-50">Tổng</td>
                    <td className="px-2 py-2 text-center text-blue-600">{formatNumber(dailyStats.reduce((s, d) => s + d.created, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.createdProductQty, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.createdShippingFee, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.createdRevenue, 0))}</td>
                    <td className="px-2 py-2 text-center">-</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyStats.reduce((s, d) => s + d.createdProfit, 0))}</td>
                    <td className="px-2 py-2 text-center text-blue-600">{formatNumber(dailyStats.reduce((s, d) => s + d.completed, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.completedProductQty, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.completedShippingFee, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.completedBuyerShippingFee, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.completedRevenue, 0))}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(dailyStats.reduce((s, d) => s + d.completedProfit, 0))}</td>
                    <td className="px-2 py-2 text-center">-</td>
                  </tr>
                  {/* Daily rows */}
                  {dailyStats.map((day) => (
                    <tr key={day.date} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-2 text-slate-600 border-r border-slate-200">{formatDate(day.date)}</td>
                      <td className="px-2 py-2 text-center text-blue-600">{formatNumber(day.created)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.createdProductQty)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.createdShippingFee)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.createdRevenue)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.createdAvgOrderValue)}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(day.createdProfit)}</td>
                      <td className="px-2 py-2 text-center text-blue-600">{formatNumber(day.completed)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.completedProductQty)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.completedShippingFee)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.completedBuyerShippingFee)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.completedRevenue)}</td>
                      <td className="px-2 py-2 text-center">{formatNumber(day.completedProfit)}</td>
                      <td className="px-2 py-2 text-center">{day.cvr > 0 ? day.cvr.toFixed(2) + '%' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
