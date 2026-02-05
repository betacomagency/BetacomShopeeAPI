/**
 * Completed Orders Tab - Đơn thành công
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
import { cn } from '@/lib/utils';

import { Dropdown, CustomTooltip } from '../components';
import { ORDER_TYPE_OPTIONS, DISPLAY_MODE_OPTIONS } from '../constants';
import { formatNumber, formatDate, formatCurrency, calculateRevenueScale, calculateOrdersScale } from '../helpers';
import type { OrderTypeFilter, DisplayMode, DailyCompletedStats, ChartDataPoint } from '../types';

interface CompletedOrdersTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
  dailyCompletedStats: DailyCompletedStats[];
}

export function CompletedOrdersTab({
  dateRange,
  onDateRangeChange,
  loading,
  dailyCompletedStats,
}: CompletedOrdersTabProps) {
  const [orderType, setOrderType] = useState<OrderTypeFilter>('completed');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('daily');
  const [hoveredSeries, setHoveredSeries] = useState<'revenue' | 'orders' | null>(null);

  // Transform data for chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!dailyCompletedStats.length) return [];
    return dailyCompletedStats.map((day) => ({
      date: day.date,
      displayDate: formatDate(day.date),
      revenue: day.revenue,
      orders: day.completed,
    }));
  }, [dailyCompletedStats]);

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

      {/* Financial Table */}
      {!loading && dailyCompletedStats.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="overflow-auto max-h-[calc(100vh-200px)] border border-slate-200 rounded-lg">
              <table className="w-full text-sm border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  {/* Header row 1: Column names */}
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th rowSpan={2} className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200 min-w-[30px]">#</th>
                    <th rowSpan={2} className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200 min-w-[80px]">Ngày/tháng</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Số lượng<br/>sản phẩm</th>
                    <th colSpan={2} className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Số đơn</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Tổng tiền<br/>hàng</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Trả lại</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">VAT</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">PSBK</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">PVC</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">PTTH</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">PBH</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Chênh phí</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Chuyển<br/>khoản</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">PCH</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">PVC</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Chiết khấu</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">SD điểm</th>
                    <th className="px-2 py-1 text-center font-medium text-slate-600 bg-slate-50 border-r border-slate-200">Đặt cọc</th>
                    <th className="px-2 py-1 text-center font-medium text-blue-600 bg-blue-50 border-r border-slate-200">Doanh thu</th>
                    <th className="px-2 py-1 text-center font-medium text-green-600 bg-green-50 border-r border-slate-200">Thực thu</th>
                    <th className="px-2 py-1 text-center font-medium text-orange-600 bg-orange-50 border-r border-slate-200">Thực trả</th>
                    <th className="px-2 py-1 text-center font-medium text-purple-600 bg-purple-50">Gửi nhận</th>
                  </tr>
                  {/* Header row 2: Sub-headers */}
                  <tr className="border-b border-slate-300 bg-slate-100 text-[10px]">
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[A]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">giao TC</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">trả TC</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[B]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[C]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[D]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[E]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[F]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[G]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[H]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[I=E-F-G]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[J]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[K]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[L]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[M]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[N]</th>
                    <th className="px-2 py-0.5 text-center text-slate-500 border-r border-slate-200">[O]</th>
                    <th className="px-2 py-0.5 text-center text-blue-500 bg-blue-50 border-r border-slate-200">[P=B-C-M-N]</th>
                    <th className="px-2 py-0.5 text-center text-green-500 bg-green-50 border-r border-slate-200">[Q=E+D+P-J]</th>
                    <th className="px-2 py-0.5 text-center text-orange-500 bg-orange-50 border-r border-slate-200">[R=E+D+P-F-G-H-J-K-L]</th>
                    <th className="px-2 py-0.5 text-center text-purple-500 bg-purple-50">[S=P-I]</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Total row */}
                  <tr className="border-b border-slate-300 bg-slate-50 font-medium">
                    <td className="px-2 py-2 text-center border-r border-slate-200"></td>
                    <td className="px-2 py-2 border-r border-slate-200">Tổng</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.productQty || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.orderCount || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.returnCount || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.totalSales || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.totalRefund || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.vat || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.buyerShippingFee || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.shippingFee || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.codFee || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.insuranceFee || 0), 0))}</td>
                    <td className="px-2 py-2 text-center text-red-600 border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.feeDiff || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.bankTransfer || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.serviceFee || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.transactionFee || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.commission || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.pointsUsed || 0), 0))}</td>
                    <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.deposit || 0), 0))}</td>
                    <td className="px-2 py-2 text-center text-blue-600 font-bold border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.revenue || 0), 0))}</td>
                    <td className="px-2 py-2 text-center text-green-600 border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.actualReceived || 0), 0))}</td>
                    <td className="px-2 py-2 text-center text-orange-600 border-r border-slate-200">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.actualPaid || 0), 0))}</td>
                    <td className="px-2 py-2 text-center text-purple-600">{formatNumber(dailyCompletedStats.reduce((s, d) => s + (d.revenue || 0) - (d.feeDiff || 0), 0))}</td>
                  </tr>
                  {/* Daily rows */}
                  {dailyCompletedStats.map((day, index) => (
                    <tr key={day.date} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">{index + 1}</td>
                      <td className="px-2 py-2 text-blue-600 border-r border-slate-200">{formatDate(day.date)}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(day.productQty || 0)}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(day.orderCount || 0)}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.returnCount || 0) > 0 ? formatNumber(day.returnCount) : ''}</td>
                      <td className="px-2 py-2 text-center text-blue-600 border-r border-slate-200">{formatNumber(day.totalSales || 0)}</td>
                      <td className="px-2 py-2 text-center text-red-600 border-r border-slate-200">{(day.totalRefund || 0) > 0 ? formatNumber(day.totalRefund) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.vat || 0) > 0 ? formatNumber(day.vat) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.buyerShippingFee || 0) > 0 ? formatNumber(day.buyerShippingFee) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.shippingFee || 0) > 0 ? formatNumber(day.shippingFee) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.codFee || 0) > 0 ? formatNumber(day.codFee) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.insuranceFee || 0) > 0 ? formatNumber(day.insuranceFee) : ''}</td>
                      <td className={cn('px-2 py-2 text-center border-r border-slate-200', (day.feeDiff || 0) < 0 ? 'text-red-600' : 'text-green-600')}>{formatNumber(day.feeDiff || 0)}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.bankTransfer || 0) > 0 ? formatNumber(day.bankTransfer) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.serviceFee || 0) > 0 ? formatNumber(day.serviceFee) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.transactionFee || 0) > 0 ? formatNumber(day.transactionFee) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.commission || 0) > 0 ? formatNumber(day.commission) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.pointsUsed || 0) > 0 ? formatNumber(day.pointsUsed) : ''}</td>
                      <td className="px-2 py-2 text-center border-r border-slate-200">{(day.deposit || 0) > 0 ? formatNumber(day.deposit) : ''}</td>
                      <td className="px-2 py-2 text-center text-blue-600 font-medium border-r border-slate-200">{formatNumber(day.revenue || 0)}</td>
                      <td className="px-2 py-2 text-center text-green-600 border-r border-slate-200">{formatNumber(day.actualReceived || 0)}</td>
                      <td className="px-2 py-2 text-center text-orange-600 border-r border-slate-200">{formatNumber(day.actualPaid || 0)}</td>
                      <td className="px-2 py-2 text-center text-purple-600">{formatNumber((day.revenue || 0) - (day.feeDiff || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes section */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700 mb-2">Ghi chú:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                <p><span className="font-medium">[A]</span> Số lượng sản phẩm</p>
                <p><span className="font-medium">[B]</span> Tổng tiền hàng (escrow_amount)</p>
                <p><span className="font-medium">[C]</span> Trả lại (escrow_refund)</p>
                <p><span className="font-medium">[D]</span> VAT</p>
                <p><span className="font-medium">[E]</span> PSBK - Phí ship bên khách (buyer_paid_shipping_fee)</p>
                <p><span className="font-medium">[F]</span> PVC - Phí vận chuyển (actual_shipping_fee)</p>
                <p><span className="font-medium">[G]</span> PTTH - Phí thu tiền hộ/COD (cod_fee)</p>
                <p><span className="font-medium">[H]</span> PBH - Phí bảo hiểm (insurance_fee)</p>
                <p><span className="font-medium">[I]</span> Chênh phí = E - F - G</p>
                <p><span className="font-medium">[J]</span> Chuyển khoản (buyer_txn_fee)</p>
                <p><span className="font-medium">[K]</span> PCH - Phí cam kết/dịch vụ (service_fee)</p>
                <p><span className="font-medium">[L]</span> PVC - Phí giao dịch thẻ (transaction_fee)</p>
                <p><span className="font-medium">[M]</span> Chiết khấu/Hoa hồng (commission_fee)</p>
                <p><span className="font-medium">[N]</span> SD điểm - Sử dụng xu/điểm (coins)</p>
                <p><span className="font-medium">[O]</span> Đặt cọc</p>
                <p><span className="font-medium text-blue-600">[P]</span> Doanh thu = B - C - M - N</p>
                <p><span className="font-medium text-green-600">[Q]</span> Thực thu = E + D + P - J</p>
                <p><span className="font-medium text-orange-600">[R]</span> Thực trả = E + D + P - F - G - H - J - K - L</p>
                <p><span className="font-medium text-purple-600">[S]</span> Gửi nhận = P - I (Shopee chuyển)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
