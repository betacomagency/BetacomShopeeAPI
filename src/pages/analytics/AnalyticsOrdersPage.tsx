/**
 * Analytics Orders Page - Báo cáo đơn hàng với nhiều tab
 */

import { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Payload } from 'recharts/types/component/DefaultTooltipContent';
import {
  ShoppingCart,
  CheckCircle,
  Banknote,
  Package,
  Activity,
  XCircle,
  ChevronDown,
  Filter,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnalyticsDateRangePicker, type AnalyticsDateRange } from '@/components/ui/date-range-picker';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useOrderReports } from '@/hooks/useOrderReports';

// ==================== TYPES ====================

type OrderTypeFilter = 'created' | 'completed';
type DisplayMode = 'daily' | 'weekly' | 'monthly';

// ==================== CONSTANTS ====================

const ORDER_TYPE_OPTIONS: { value: OrderTypeFilter; label: string }[] = [
  { value: 'created', label: 'Ngày tạo' },
  { value: 'completed', label: 'Ngày hoàn thành' },
];

const DISPLAY_MODE_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: 'daily', label: 'Theo ngày' },
  { value: 'weekly', label: 'Theo tuần' },
  { value: 'monthly', label: 'Theo tháng' },
];

// Default date range: this month
function getDefaultDateRange(): AnalyticsDateRange {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: firstDay, to: lastDay };
}

// Chart colors
const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1', '#14B8A6'];
const STATUS_COLORS: Record<string, string> = {
  'COMPLETED': '#10B981',
  'SHIPPED': '#3B82F6',
  'TO_CONFIRM_RECEIVE': '#8B5CF6',
  'READY_TO_SHIP': '#F59E0B',
  'PROCESSED': '#6366F1',
  'UNPAID': '#94A3B8',
  'CANCELLED': '#EF4444',
  'IN_CANCEL': '#F87171',
  'TO_RETURN': '#F97316',
  'PENDING': '#CBD5E1',
};

// Tab configuration
const TABS = [
  { id: 'created', label: 'Đơn tạo', icon: ShoppingCart },
  { id: 'completed', label: 'Đơn thành công', icon: CheckCircle },
  { id: 'value', label: 'Theo giá trị đơn hàng', icon: Banknote },
  { id: 'product', label: 'Theo sản phẩm', icon: Package },
  { id: 'status', label: 'Theo trạng thái', icon: Activity },
  { id: 'cancel', label: 'Lý do khách hủy', icon: XCircle },
];

// ==================== HELPERS ====================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

function formatCurrency(num: number): string {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
  return num.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ==================== COMPONENTS ====================

// Dropdown component
function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={cn('relative', className)}>
      {label && <div className="text-xs text-slate-500 mb-1">{label}</div>}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer bg-white min-w-[140px]"
      >
        <span className="text-slate-700">{selectedOption?.label}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-full">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer',
                  value === option.value && 'bg-blue-50 text-blue-600 font-medium'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Custom tooltip for main chart
interface ChartDataPayload {
  date: string;
  displayDate: string;
  revenue: number;
  orders: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Payload<number, string>[] }) {
  if (!active || !payload || !payload.length) return null;

  const dataPayload = payload[0]?.payload as ChartDataPayload | undefined;
  const originalDate = dataPayload?.date;

  let formattedDate = 'N/A';
  if (originalDate) {
    const date = new Date(originalDate + 'T00:00:00');
    formattedDate = date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[200px]">
      <p className="text-sm font-medium text-slate-700 mb-2">{formattedDate}</p>
      <div className="space-y-1.5">
        {payload.map((entry: Payload<number, string>, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-slate-600">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-slate-800">
              {entry.name === 'Doanh thu'
                ? formatNumber(Number(entry.value || 0)) + 'đ'
                : formatNumber(Number(entry.value || 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function AnalyticsOrdersPage() {
  const { user } = useAuth();
  const { selectedShopId } = useShopeeAuth();

  // Filter states
  const [orderType, setOrderType] = useState<OrderTypeFilter>('created');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('daily');
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(getDefaultDateRange);
  const [activeTab, setActiveTab] = useState('created');

  // Product tab states
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<'quantity' | 'name' | 'completed' | 'cancelled'>('quantity');

  // Hover state for chart interaction
  const [hoveredSeries, setHoveredSeries] = useState<'revenue' | 'orders' | null>(null);

  const { data, loading } = useOrderReports(
    selectedShopId || 0,
    user?.id || '',
    null, // Don't use preset
    dateRange // Use custom date range
  );

  // Transform data for "Đơn tạo" tab (grouped by create_time)
  const chartDataCreated = useMemo(() => {
    if (!data.dailyStats.length) return [];
    return data.dailyStats.map((day) => ({
      date: day.date,
      displayDate: formatDate(day.date),
      revenue: day.revenue,
      orders: day.created,
    }));
  }, [data.dailyStats]);

  // Transform data for "Đơn thành công" tab (grouped by completion date)
  const chartDataCompleted = useMemo(() => {
    if (!data.dailyCompletedStats.length) return [];
    return data.dailyCompletedStats.map((day) => ({
      date: day.date,
      displayDate: formatDate(day.date),
      revenue: day.revenue,
      orders: day.completed,
    }));
  }, [data.dailyCompletedStats]);

  // Filtered and sorted products for product tab
  const filteredProducts = useMemo(() => {
    let products = [...data.productDetailedStats];

    // Filter by search
    if (productSearch.trim()) {
      const searchLower = productSearch.toLowerCase();
      products = products.filter((p) =>
        p.itemName.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (productSort) {
      case 'name':
        products.sort((a, b) => a.itemName.localeCompare(b.itemName, 'vi'));
        break;
      case 'completed':
        products.sort((a, b) => b.completedSP - a.completedSP);
        break;
      case 'cancelled':
        products.sort((a, b) => b.cancelledPercent - a.cancelledPercent);
        break;
      case 'quantity':
      default:
        products.sort((a, b) => b.ordersSP - a.ordersSP);
        break;
    }

    return products;
  }, [data.productDetailedStats, productSearch, productSort]);

  // Use the appropriate chart data based on active tab
  const chartData = activeTab === 'completed' ? chartDataCompleted : chartDataCreated;

  // Dynamic Y-axis scales based on data
  const { maxRevenue, revenueTicks } = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.revenue), 0);
    if (max === 0) return { maxRevenue: 1000000, revenueTicks: [0, 250000, 500000, 750000, 1000000] };

    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const normalized = max / magnitude;
    let niceMax: number;

    if (normalized <= 1) niceMax = magnitude;
    else if (normalized <= 1.5) niceMax = 1.5 * magnitude;
    else if (normalized <= 2) niceMax = 2 * magnitude;
    else if (normalized <= 3) niceMax = 3 * magnitude;
    else if (normalized <= 4) niceMax = 4 * magnitude;
    else if (normalized <= 5) niceMax = 5 * magnitude;
    else if (normalized <= 6) niceMax = 6 * magnitude;
    else if (normalized <= 8) niceMax = 8 * magnitude;
    else niceMax = 10 * magnitude;

    const step = niceMax / 4;
    const ticks = [0, step, step * 2, step * 3, niceMax];

    return { maxRevenue: niceMax, revenueTicks: ticks };
  }, [chartData]);

  const { maxOrders, ordersTicks } = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.orders), 0);
    if (max === 0) return { maxOrders: 100, ordersTicks: [0, 25, 50, 75, 100] };

    let niceMax: number;
    let step: number;

    if (max <= 10) { niceMax = 10; step = 2; }
    else if (max <= 20) { niceMax = 20; step = 5; }
    else if (max <= 50) { niceMax = 50; step = 10; }
    else if (max <= 100) { niceMax = 100; step = 25; }
    else if (max <= 200) { niceMax = 200; step = 50; }
    else if (max <= 500) { niceMax = 500; step = 100; }
    else if (max <= 1000) { niceMax = Math.ceil(max / 200) * 200; step = niceMax / 4; }
    else { const mag = Math.pow(10, Math.floor(Math.log10(max))); niceMax = Math.ceil(max / mag) * mag; step = niceMax / 4; }

    const ticks = [0, step, step * 2, step * 3, niceMax];
    return { maxOrders: niceMax, ordersTicks: ticks };
  }, [chartData]);

  // Handle legend/series hover
  const handleMouseEnterBar = useCallback(() => setHoveredSeries('revenue'), []);
  const handleMouseEnterLine = useCallback(() => setHoveredSeries('orders'), []);
  const handleMouseLeave = useCallback(() => setHoveredSeries(null), []);

  if (!selectedShopId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Vui lòng chọn shop để xem báo cáo</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render filters for chart tabs
  const renderFilters = () => (
    <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-slate-100">
      <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />
      <Dropdown label="Loại" value={orderType} options={ORDER_TYPE_OPTIONS} onChange={setOrderType} />
      <Dropdown label="Hiển thị" value={displayMode} options={DISPLAY_MODE_OPTIONS} onChange={setDisplayMode} />
      <div className="flex-1" />
      <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
        <Filter className="w-4 h-4 mr-1" />
        Lọc
      </Button>
    </div>
  );

  // Render main chart (Bar + Line)
  const renderMainChart = () => (
    <>
      {loading ? (
        <div className="h-[320px] flex items-center justify-center">
          <Spinner className="w-8 h-8" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[320px] flex items-center justify-center text-slate-400">
          Chưa có dữ liệu
        </div>
      ) : (
        <div className="outline-none focus:outline-none" style={{ outline: 'none' }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }} onMouseLeave={handleMouseLeave}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={5} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={formatCurrency} domain={[0, maxRevenue]} ticks={revenueTicks} width={50} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} domain={[0, maxOrders]} ticks={ordersTicks} width={40} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
              <Legend
                verticalAlign="bottom"
                height={24}
                wrapperStyle={{ paddingTop: '4px', paddingBottom: '0px' }}
                iconType="circle"
                onMouseEnter={(e) => { if (e.dataKey === 'revenue') setHoveredSeries('revenue'); else if (e.dataKey === 'orders') setHoveredSeries('orders'); }}
                onMouseLeave={() => setHoveredSeries(null)}
                formatter={(value, entry) => (
                  <span className="text-sm cursor-pointer" style={{ color: hoveredSeries && hoveredSeries !== entry.dataKey ? '#94A3B8' : '#475569' }}>
                    {value}
                  </span>
                )}
              />
              <Bar yAxisId="left" dataKey="revenue" fill={hoveredSeries === 'orders' ? 'rgba(59, 130, 246, 0.3)' : '#3B82F6'} radius={[2, 2, 0, 0]} maxBarSize={28} name="Doanh thu" onMouseEnter={handleMouseEnterBar} onMouseLeave={handleMouseLeave} style={{ transition: 'fill 0.2s ease' }} />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke={hoveredSeries === 'revenue' ? 'rgba(239, 68, 68, 0.3)' : '#EF4444'} strokeWidth={2} dot={{ fill: hoveredSeries === 'revenue' ? 'rgba(239, 68, 68, 0.3)' : '#EF4444', r: 5, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: '#EF4444', onMouseEnter: handleMouseEnterLine }} name="Đơn" onMouseEnter={handleMouseEnterLine} onMouseLeave={handleMouseLeave} style={{ transition: 'stroke 0.2s ease' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-slate-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer data-[state=active]:bg-white">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab: Đơn tạo */}
        <TabsContent value="created" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {renderFilters()}
              {renderMainChart()}
            </CardContent>
          </Card>

          {/* Daily Stats Table */}
          {!loading && data.dailyStats.length > 0 && (
            <Card className="mt-4">
              <CardContent className="pt-4">
                {/* Table */}
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
                      {/* Summary rows */}
                      <tr className="border-b border-slate-200 bg-blue-50 font-medium">
                        <td className="px-2 py-2 text-slate-700 border-r border-slate-200 bg-blue-50">Tổng</td>
                        <td className="px-2 py-2 text-center text-blue-600">{formatNumber(data.dailyStats.reduce((s, d) => s + d.created, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.createdProductQty, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.createdShippingFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.createdRevenue, 0))}</td>
                        <td className="px-2 py-2 text-center">-</td>
                        <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(data.dailyStats.reduce((s, d) => s + d.createdProfit, 0))}</td>
                        <td className="px-2 py-2 text-center text-blue-600">{formatNumber(data.dailyStats.reduce((s, d) => s + d.completed, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.completedProductQty, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.completedShippingFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.completedBuyerShippingFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.completedRevenue, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyStats.reduce((s, d) => s + d.completedProfit, 0))}</td>
                        <td className="px-2 py-2 text-center">-</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="px-2 py-2 text-slate-600 border-r border-slate-200 bg-slate-50">Trung bình</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.created, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.createdProductQty, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.createdShippingFee, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.createdRevenue, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.createdAvgOrderValue, 0) / data.dailyStats.filter(d => d.created > 0).length || 0))}</td>
                        <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.createdProfit, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.completed, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.completedProductQty, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.completedShippingFee, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.completedBuyerShippingFee, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.completedRevenue, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(Math.round(data.dailyStats.reduce((s, d) => s + d.completedProfit, 0) / data.dailyStats.length))}</td>
                        <td className="px-2 py-2 text-center">
                          {(() => {
                            const totalCreated = data.dailyStats.reduce((s, d) => s + d.created, 0);
                            const totalCompleted = data.dailyStats.reduce((s, d) => s + d.completed, 0);
                            return totalCreated > 0 ? (totalCompleted / totalCreated * 100).toFixed(2) + '%' : '-';
                          })()}
                        </td>
                      </tr>
                      {/* Daily rows */}
                      {data.dailyStats.map((day) => (
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

                {/* Notes */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <p className="mb-2">
                    <strong>Lưu ý:</strong> Báo cáo này lọc đơn hàng tính theo ngày tạo đơn nên sẽ không khớp với báo cáo doanh thu (tính theo ngày thành công của đơn)
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Cột "đơn tạo theo ngày đã thành công" có thể thay đổi dữ liệu tại các thời điểm xem báo cáo khác nhau</li>
                    <li>CVR = Tỷ lệ chuyển đổi = Đơn thành công / Đơn tạo × 100%</li>
                    <li>Phí trả HVC = Phí vận chuyển + Phí COD + Phí vượt cân</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Đơn thành công */}
        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {renderFilters()}
              {renderMainChart()}
            </CardContent>
          </Card>

          {/* Financial Table */}
          {!loading && data.dailyCompletedStats.length > 0 && (
            <Card className="mt-4">
              <CardContent className="pt-4">
                <div className="overflow-auto max-h-[calc(100vh-200px)] border border-slate-200 rounded-lg">
                  <table className="w-full text-sm border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[30px]">#</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[70px]">Ngày</th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[60px]">
                          <div>SLSP</div>
                          <div className="text-xs text-slate-400">[1]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[60px]">
                          <div>SL đơn</div>
                          <div className="text-xs text-slate-400">[2]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[50px]">
                          <div className="text-xs text-slate-400">[3]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[100px]">
                          <div>Tổng bán</div>
                          <div className="text-xs text-slate-400">[4]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>Tổng trả</div>
                          <div className="text-xs text-slate-400">[5]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[60px]">
                          <div>VAT</div>
                          <div className="text-xs text-slate-400">[6]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>PSBK</div>
                          <div className="text-xs text-slate-400">[7]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>PVC</div>
                          <div className="text-xs text-slate-400">[8]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>PTTH</div>
                          <div className="text-xs text-slate-400">[9]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[60px]">
                          <div>PBH</div>
                          <div className="text-xs text-slate-400">[9A]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>Chênh phí</div>
                          <div className="text-xs text-slate-400">[10=7-8-9]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>Chuyển khoản</div>
                          <div className="text-xs text-slate-400">[11]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[70px]">
                          <div>PCH</div>
                          <div className="text-xs text-slate-400">[12]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[70px]">
                          <div>PVC</div>
                          <div className="text-xs text-slate-400">[13]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[90px]">
                          <div>Chiết khấu</div>
                          <div className="text-xs text-slate-400">[14]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[70px]">
                          <div>SD điểm</div>
                          <div className="text-xs text-slate-400">[14A]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-slate-600 bg-slate-50 min-w-[70px]">
                          <div>Đặt cọc</div>
                          <div className="text-xs text-slate-400">[15]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-blue-600 bg-blue-50 min-w-[100px]">
                          <div>Doanh thu</div>
                          <div className="text-xs text-blue-400">[16=4-5-14-14A]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-green-600 bg-green-50 min-w-[100px]">
                          <div>Thực thu</div>
                          <div className="text-xs text-green-400">[17=7+6+16-11]</div>
                        </th>
                        <th className="px-2 py-2 text-center font-medium text-orange-600 bg-orange-50 min-w-[100px]">
                          <div>Thực trả</div>
                          <div className="text-xs text-orange-400">[18=7+6+16-8-9-9A-11-12-13]</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Total row */}
                      <tr className="border-b border-slate-200 bg-blue-50 font-medium">
                        <td className="px-2 py-2 text-center text-slate-700 bg-blue-50"></td>
                        <td className="px-2 py-2 text-slate-700 bg-blue-50">Tổng</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.productQty, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.orderCount, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.itemCount, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.totalSales, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.totalRefund, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.vat, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.buyerShippingFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.shippingFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.codFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.insuranceFee, 0))}</td>
                        <td className="px-2 py-2 text-center text-red-600">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.feeDiff, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.bankTransfer, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.serviceFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.transactionFee, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.commission, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.pointsUsed, 0))}</td>
                        <td className="px-2 py-2 text-center">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.deposit, 0))}</td>
                        <td className="px-2 py-2 text-center text-blue-600 font-bold">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.revenue, 0))}</td>
                        <td className="px-2 py-2 text-center text-green-600">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.actualReceived, 0))}</td>
                        <td className="px-2 py-2 text-center text-orange-600">{formatNumber(data.dailyCompletedStats.reduce((s, d) => s + d.actualPaid, 0))}</td>
                      </tr>
                      {/* Daily rows */}
                      {data.dailyCompletedStats.map((day, index) => (
                        <tr key={day.date} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-2 text-center text-slate-500">{index + 1}</td>
                          <td className="px-2 py-2 text-blue-600">{formatDate(day.date)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.productQty)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.orderCount)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.itemCount)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.totalSales)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.totalRefund)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.vat)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.buyerShippingFee)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.shippingFee)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.codFee)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.insuranceFee)}</td>
                          <td className={cn("px-2 py-2 text-center", day.feeDiff < 0 ? "text-red-600" : "text-green-600")}>{formatNumber(day.feeDiff)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.bankTransfer)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.serviceFee)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.transactionFee)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.commission)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.pointsUsed)}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(day.deposit)}</td>
                          <td className="px-2 py-2 text-center text-blue-600 font-medium">{formatNumber(day.revenue)}</td>
                          <td className="px-2 py-2 text-center text-green-600">{formatNumber(day.actualReceived)}</td>
                          <td className="px-2 py-2 text-center text-orange-600">{formatNumber(day.actualPaid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                  <p className="font-medium mb-2">Chú thích:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                    <div>SLSP = Số lượng sản phẩm</div>
                    <div>PSBK = Phí ship báo khách</div>
                    <div>PVC = Phí vận chuyển</div>
                    <div>PTTH = Phí thu hộ (COD)</div>
                    <div>PBH = Phí bảo hiểm</div>
                    <div>PCH = Phí cố định Shopee</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Theo giá trị đơn hàng */}
        <TabsContent value="value" className="mt-4">
          {/* Date Range Filter */}
          <Card className="mb-4">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />
                <div className="flex-1" />
                <div className="text-sm text-slate-500">
                  Tổng đơn hoàn thành: <span className="font-medium text-blue-600">{formatNumber(data.totals.completed)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: By Price Range */}
            <Card>
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-base font-medium">Giá trị đơn hàng theo khoảng giá</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[180px] flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.valueRanges.filter((r) => r.count > 0) as unknown as Record<string, unknown>[]}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="count"
                        nameKey="range"
                      >
                        {data.valueRanges.filter((r) => r.count > 0).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, props) => {
                          const payload = props.payload as { range?: string; percent?: number } | undefined;
                          return [
                            `${formatNumber(Number(value))} đơn (${payload?.percent?.toFixed(2) || 0}%)`,
                            payload?.range || ''
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* Color Legend */}
                <div className="flex flex-wrap gap-2 mb-3 px-1">
                  {data.valueRanges.filter(r => r.count > 0).map((range, index) => (
                    <div key={range.range} className="flex items-center gap-1 text-xs">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-slate-600">{range.range}</span>
                    </div>
                  ))}
                </div>
                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-center font-medium text-slate-600 w-8">#</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600">Khoảng giá</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600">Tổng hóa đơn</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600 w-20">Tỷ lệ(%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Total row */}
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2 text-right font-medium">Tổng</td>
                        <td className="px-2 py-2 text-right text-blue-600 font-medium">
                          {formatNumber(data.valueRanges.reduce((s, r) => s + r.count, 0))}
                        </td>
                        <td className="px-2 py-2 text-right font-medium">100%</td>
                      </tr>
                      {/* Data rows - only show rows with count > 0 */}
                      {data.valueRanges.filter(r => r.count > 0).map((range, index) => {
                        const maxCount = Math.max(...data.valueRanges.map(r => r.count));
                        const barWidth = maxCount > 0 ? (range.count / maxCount) * 100 : 0;
                        return (
                          <tr key={range.range} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-1.5 text-center text-blue-600">{index + 1}</td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span>{range.range}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex-1 max-w-[80px]">
                                  <div
                                    className="h-4 bg-blue-200 rounded-sm"
                                    style={{ width: `${barWidth}%`, marginLeft: 'auto' }}
                                  />
                                </div>
                                <span className="w-14 text-right tabular-nums">{formatNumber(range.count)}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{range.percent.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Right: By Product Quantity */}
            <Card>
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-base font-medium">Giá trị đơn hàng theo số lượng sản phẩm</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[180px] flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.quantityRanges.filter((r) => r.count > 0) as unknown as Record<string, unknown>[]}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="count"
                        nameKey="range"
                      >
                        {data.quantityRanges.filter((r) => r.count > 0).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, props) => {
                          const payload = props.payload as { range?: string; percent?: number } | undefined;
                          return [
                            `${formatNumber(Number(value))} đơn (${payload?.percent?.toFixed(2) || 0}%)`,
                            payload?.range || ''
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* Color Legend */}
                <div className="flex flex-wrap gap-2 mb-3 px-1">
                  {data.quantityRanges.filter(r => r.count > 0).map((range, index) => (
                    <div key={range.range} className="flex items-center gap-1 text-xs">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-slate-600">{range.range}</span>
                    </div>
                  ))}
                </div>
                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-center font-medium text-slate-600 w-8">#</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600">Khoảng SL sản phẩm</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600">Tổng hóa đơn</th>
                        <th className="px-2 py-2 text-right font-medium text-slate-600 w-20">Tỷ lệ(%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Total row */}
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2 text-right font-medium">Tổng</td>
                        <td className="px-2 py-2 text-right text-blue-600 font-medium">
                          {formatNumber(data.quantityRanges.reduce((s, r) => s + r.count, 0))}
                        </td>
                        <td className="px-2 py-2 text-right font-medium">100%</td>
                      </tr>
                      {/* Data rows - only show rows with count > 0 */}
                      {data.quantityRanges.filter(r => r.count > 0).map((range, index) => {
                        const maxCount = Math.max(...data.quantityRanges.map(r => r.count));
                        const barWidth = maxCount > 0 ? (range.count / maxCount) * 100 : 0;
                        return (
                          <tr key={range.range} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-1.5 text-center text-blue-600">{index + 1}</td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span>{range.range}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex-1 max-w-[80px]">
                                  <div
                                    className="h-4 bg-blue-200 rounded-sm"
                                    style={{ width: `${barWidth}%`, marginLeft: 'auto' }}
                                  />
                                </div>
                                <span className="w-14 text-right tabular-nums">{formatNumber(range.count)}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{range.percent.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Theo sản phẩm */}
        <TabsContent value="product" className="mt-4">
          {/* Date Range Filter + Search + Sort */}
          <Card className="mb-4">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm sản phẩm..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-4 h-4 text-slate-400" />
                  <select
                    value={productSort}
                    onChange={(e) => setProductSort(e.target.value as 'quantity' | 'name' | 'completed' | 'cancelled')}
                    className="px-2 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="quantity">SL đặt hàng</option>
                    <option value="completed">SL thành công</option>
                    <option value="cancelled">Tỷ lệ hủy</option>
                    <option value="name">Tên A-Z</option>
                  </select>
                </div>

                <div className="flex-1" />
                <div className="text-sm text-slate-500">
                  {productSearch ? (
                    <>Tìm thấy: <span className="font-medium text-blue-600">{formatNumber(filteredProducts.length)}</span> / {formatNumber(data.productDetailedStats.length)} SP</>
                  ) : (
                    <>Tổng sản phẩm: <span className="font-medium text-blue-600">{formatNumber(data.productDetailedStats.length)}</span></>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="h-[300px] flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-slate-400">
                  {productSearch ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có dữ liệu'}
                </div>
              ) : (
                <>
                  <div className="overflow-auto max-h-[calc(100vh-320px)] border border-slate-200 rounded-lg">
                    <table className="w-full text-sm border-collapse whitespace-nowrap">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-200">
                          <th rowSpan={2} className="px-2 py-2 text-left font-medium text-slate-600 border-r border-slate-200 bg-slate-50 min-w-[200px]">Sản phẩm</th>
                          <th rowSpan={2} className="px-2 py-2 text-right font-medium text-slate-600 border-r border-slate-200 bg-slate-50 min-w-[80px]">Giá</th>
                          <th colSpan={2} className="px-2 py-2 text-center font-medium text-slate-700 border-r border-slate-200 bg-blue-50">Đặt hàng</th>
                          <th colSpan={3} className="px-2 py-2 text-center font-medium text-slate-700 border-r border-slate-200 bg-red-50">Hủy</th>
                          <th colSpan={2} className="px-2 py-2 text-center font-medium text-slate-700 border-r border-slate-200 bg-yellow-50">Đang chuyển</th>
                          <th colSpan={3} className="px-2 py-2 text-center font-medium text-slate-700 border-r border-slate-200 bg-green-50">Thành công</th>
                          <th colSpan={3} className="px-2 py-2 text-center font-medium text-slate-700 border-r border-slate-200 bg-orange-50">Chuyển hoàn</th>
                          <th colSpan={3} className="px-2 py-2 text-center font-medium text-slate-700 bg-slate-100">Chưa gửi HVC</th>
                        </tr>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-blue-50">Đơn</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-blue-50">SP</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-red-50">Đơn</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-red-50">SP</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-red-50">%</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-yellow-50">Đơn</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-yellow-50">SP</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-green-50">Đơn</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-green-50">SP</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-green-50">%</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-orange-50">Đơn</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-orange-50">SP</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs border-r border-slate-200 bg-orange-50">%</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-100">Đơn</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-100">SP</th>
                          <th className="px-2 py-1.5 text-center font-medium text-slate-600 text-xs bg-slate-100">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Summary row */}
                        <tr className="border-b border-slate-200 bg-blue-50 font-medium">
                          <td className="px-2 py-2 text-slate-700 border-r border-slate-200">Tổng ({filteredProducts.length} SP)</td>
                          <td className="px-2 py-2 text-right border-r border-slate-200">-</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.ordersCount, 0))}</td>
                          <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(filteredProducts.reduce((s, p) => s + p.ordersSP, 0))}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.cancelledOrders, 0))}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.cancelledSP, 0))}</td>
                          <td className="px-2 py-2 text-center border-r border-slate-200">-</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.shippingOrders, 0))}</td>
                          <td className="px-2 py-2 text-center border-r border-slate-200">{formatNumber(filteredProducts.reduce((s, p) => s + p.shippingSP, 0))}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.completedOrders, 0))}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.completedSP, 0))}</td>
                          <td className="px-2 py-2 text-center border-r border-slate-200">-</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.returnsOrders, 0))}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.returnsSP, 0))}</td>
                          <td className="px-2 py-2 text-center border-r border-slate-200">-</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.notShippedOrders, 0))}</td>
                          <td className="px-2 py-2 text-center">{formatNumber(filteredProducts.reduce((s, p) => s + p.notShippedSP, 0))}</td>
                          <td className="px-2 py-2 text-center">-</td>
                        </tr>
                        {/* Product rows */}
                        {filteredProducts.map((product) => (
                          <tr key={product.itemId} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-2 py-2 border-r border-slate-200">
                              <div className="flex items-center gap-2">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.itemName} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <span className="truncate max-w-[180px]" title={product.itemName}>{product.itemName}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right border-r border-slate-200">{formatNumber(product.price)}</td>
                            <td className="px-2 py-2 text-center text-blue-600">{formatNumber(product.ordersCount)}</td>
                            <td className="px-2 py-2 text-center text-blue-600 border-r border-slate-200">{formatNumber(product.ordersSP)}</td>
                            <td className="px-2 py-2 text-center text-red-600">{product.cancelledOrders > 0 ? formatNumber(product.cancelledOrders) : '-'}</td>
                            <td className="px-2 py-2 text-center text-red-600">{product.cancelledSP > 0 ? formatNumber(product.cancelledSP) : '-'}</td>
                            <td className="px-2 py-2 text-center text-red-600 border-r border-slate-200">{product.cancelledPercent > 0 ? product.cancelledPercent.toFixed(1) + '%' : '-'}</td>
                            <td className="px-2 py-2 text-center text-yellow-600">{product.shippingOrders > 0 ? formatNumber(product.shippingOrders) : '-'}</td>
                            <td className="px-2 py-2 text-center text-yellow-600 border-r border-slate-200">{product.shippingSP > 0 ? formatNumber(product.shippingSP) : '-'}</td>
                            <td className="px-2 py-2 text-center text-green-600">{product.completedOrders > 0 ? formatNumber(product.completedOrders) : '-'}</td>
                            <td className="px-2 py-2 text-center text-green-600">{product.completedSP > 0 ? formatNumber(product.completedSP) : '-'}</td>
                            <td className="px-2 py-2 text-center text-green-600 border-r border-slate-200">{product.completedPercent > 0 ? product.completedPercent.toFixed(1) + '%' : '-'}</td>
                            <td className="px-2 py-2 text-center text-orange-600">{product.returnsOrders > 0 ? formatNumber(product.returnsOrders) : '-'}</td>
                            <td className="px-2 py-2 text-center text-orange-600">{product.returnsSP > 0 ? formatNumber(product.returnsSP) : '-'}</td>
                            <td className="px-2 py-2 text-center text-orange-600 border-r border-slate-200">{product.returnsPercent > 0 ? product.returnsPercent.toFixed(1) + '%' : '-'}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{product.notShippedOrders > 0 ? formatNumber(product.notShippedOrders) : '-'}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{product.notShippedSP > 0 ? formatNumber(product.notShippedSP) : '-'}</td>
                            <td className="px-2 py-2 text-center text-slate-500">{product.notShippedPercent > 0 ? product.notShippedPercent.toFixed(1) + '%' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Notes */}
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                    <p className="font-medium mb-2">Ghi chú:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Cột "Đang chuyển" bao gồm các trạng thái: Chờ lấy hàng + Đang giao + Chờ xác nhận</li>
                      <li>Cột "Chuyển hoàn" đếm số lượng theo trạng thái đơn hàng là "Trả hàng"</li>
                      <li>Cột "Chưa gửi HVC" bao gồm: Chưa thanh toán + Đã xử lý + Đang xử lý</li>
                      <li>Báo cáo này tổng hợp số lượng sản phẩm từ danh sách đơn hàng</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Theo trạng thái */}
        <TabsContent value="status" className="mt-4">
          {/* Warning Note */}
          <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-sm text-cyan-800">
            <div className="flex items-start gap-2">
              <span className="text-cyan-600 font-medium">⚠ Lưu ý</span>
            </div>
            <ul className="mt-2 space-y-1 text-cyan-700">
              <li>- Các đơn hàng đã tạo quá lâu mà vẫn ở trạng thái <span className="font-medium text-teal-600">đang xác nhận, đóng gói</span> thì có thể nhân viên đã quên xử lý → Kiểm tra lại xem khách có muốn lấy hàng nữa không thì hủy đơn / gửi hàng đi.</li>
              <li>- Các đơn hàng gửi hãng vận chuyển quá lâu mà vẫn chưa <span className="font-medium text-green-600">thành công</span> / <span className="font-medium text-orange-600">hoàn</span> về thì cần kiểm tra lại tình trạng đơn, khiếu nại báo mất hàng, hoàn hàng.</li>
            </ul>
          </div>

          {/* Date Range Filter */}
          <Card className="mb-4">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />
                <div className="flex-1" />
                <div className="text-sm text-slate-500">
                  Tổng đơn: <span className="font-medium text-blue-600">{formatNumber(data.totals.created)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="h-[300px] flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
              ) : data.dailyStatusStats.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-slate-400">Chưa có dữ liệu</div>
              ) : (
                <>
                  <div className="overflow-auto max-h-[calc(100vh-280px)] border border-slate-200 rounded-lg">
                    <table className="w-full text-sm border-collapse whitespace-nowrap">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 text-left font-medium text-slate-600 border-r border-slate-200 min-w-[80px]">Thời gian</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-600 border-r border-slate-200 min-w-[90px]">Xác nhận</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-600 border-r border-slate-200 min-w-[90px]">Đóng gói</th>
                          <th className="px-3 py-2 text-center font-medium text-yellow-600 border-r border-slate-200 min-w-[100px]">Đang chuyển</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-600 border-r border-slate-200 min-w-[80px]">Thất bại</th>
                          <th className="px-3 py-2 text-center font-medium text-green-600 border-r border-slate-200 min-w-[110px]">Thành công</th>
                          <th className="px-3 py-2 text-center font-medium text-red-600 border-r border-slate-200 min-w-[90px]">Hủy</th>
                          <th className="px-3 py-2 text-center font-medium text-orange-600 border-r border-slate-200 min-w-[100px]">Chuyển hoàn</th>
                          <th className="px-3 py-2 text-center font-medium text-blue-600 min-w-[100px]">Tổng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Summary rows */}
                        {(() => {
                          const totals = data.dailyStatusStats.reduce(
                            (acc, day) => ({
                              confirmed: acc.confirmed + day.confirmedCount,
                              confirmedAmt: acc.confirmedAmt + day.confirmedAmount,
                              packaging: acc.packaging + day.packagingCount,
                              packagingAmt: acc.packagingAmt + day.packagingAmount,
                              shipping: acc.shipping + day.shippingCount,
                              shippingAmt: acc.shippingAmt + day.shippingAmount,
                              failed: acc.failed + day.failedCount,
                              failedAmt: acc.failedAmt + day.failedAmount,
                              completed: acc.completed + day.completedCount,
                              completedAmt: acc.completedAmt + day.completedAmount,
                              cancelled: acc.cancelled + day.cancelledCount,
                              cancelledAmt: acc.cancelledAmt + day.cancelledAmount,
                              returns: acc.returns + day.returnsCount,
                              returnsAmt: acc.returnsAmt + day.returnsAmount,
                              total: acc.total + day.totalCount,
                              totalAmt: acc.totalAmt + day.totalAmount,
                            }),
                            { confirmed: 0, confirmedAmt: 0, packaging: 0, packagingAmt: 0, shipping: 0, shippingAmt: 0, failed: 0, failedAmt: 0, completed: 0, completedAmt: 0, cancelled: 0, cancelledAmt: 0, returns: 0, returnsAmt: 0, total: 0, totalAmt: 0 }
                          );
                          const days = data.dailyStatusStats.length;
                          const avg = {
                            confirmed: Math.round(totals.confirmed / days * 1000) / 1000,
                            confirmedAmt: Math.round(totals.confirmedAmt / days),
                            packaging: Math.round(totals.packaging / days * 1000) / 1000,
                            packagingAmt: Math.round(totals.packagingAmt / days),
                            shipping: Math.round(totals.shipping / days * 1000) / 1000,
                            shippingAmt: Math.round(totals.shippingAmt / days),
                            failed: Math.round(totals.failed / days * 1000) / 1000,
                            failedAmt: Math.round(totals.failedAmt / days),
                            completed: Math.round(totals.completed / days * 1000) / 1000,
                            completedAmt: Math.round(totals.completedAmt / days),
                            cancelled: Math.round(totals.cancelled / days * 1000) / 1000,
                            cancelledAmt: Math.round(totals.cancelledAmt / days),
                            returns: Math.round(totals.returns / days * 1000) / 1000,
                            returnsAmt: Math.round(totals.returnsAmt / days),
                            total: Math.round(totals.total / days * 1000) / 1000,
                            totalAmt: Math.round(totals.totalAmt / days),
                          };
                          const pct = {
                            confirmed: totals.total > 0 ? (totals.confirmed / totals.total * 100).toFixed(2) : '0',
                            packaging: totals.total > 0 ? (totals.packaging / totals.total * 100).toFixed(2) : '0',
                            shipping: totals.total > 0 ? (totals.shipping / totals.total * 100).toFixed(2) : '0',
                            failed: totals.total > 0 ? (totals.failed / totals.total * 100).toFixed(2) : '0',
                            completed: totals.total > 0 ? (totals.completed / totals.total * 100).toFixed(2) : '0',
                            cancelled: totals.total > 0 ? (totals.cancelled / totals.total * 100).toFixed(2) : '0',
                            returns: totals.total > 0 ? (totals.returns / totals.total * 100).toFixed(2) : '0',
                          };
                          return (
                            <>
                              {/* Total row */}
                              <tr className="border-b border-slate-200 bg-blue-50 font-medium">
                                <td className="px-3 py-2 text-slate-700 border-r border-slate-200">Tổng</td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{formatNumber(totals.confirmed)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(totals.confirmedAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{formatNumber(totals.packaging)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(totals.packagingAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center text-yellow-600 border-r border-slate-200">
                                  <div>{formatNumber(totals.shipping)}</div>
                                  <div className="text-xs text-yellow-500">{formatNumber(totals.shippingAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{formatNumber(totals.failed)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(totals.failedAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center text-green-600 border-r border-slate-200">
                                  <div>{formatNumber(totals.completed)}</div>
                                  <div className="text-xs text-green-500">{formatNumber(totals.completedAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center text-red-600 border-r border-slate-200">
                                  <div>{formatNumber(totals.cancelled)}</div>
                                  <div className="text-xs text-red-500">{formatNumber(totals.cancelledAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center text-orange-600 border-r border-slate-200">
                                  <div>{formatNumber(totals.returns)}</div>
                                  <div className="text-xs text-orange-500">{formatNumber(totals.returnsAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center text-blue-600">
                                  <div>{formatNumber(totals.total)}</div>
                                  <div className="text-xs text-blue-500">{formatNumber(totals.totalAmt)}</div>
                                </td>
                              </tr>
                              {/* Average row */}
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <td className="px-3 py-2 text-slate-600 border-r border-slate-200">Trung bình</td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.confirmed.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.confirmedAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.packaging.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.packagingAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.shipping.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.shippingAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.failed.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.failedAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.completed.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.completedAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.cancelled.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.cancelledAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">
                                  <div>{avg.returns.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.returnsAmt)}</div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div>{avg.total.toFixed(3)}</div>
                                  <div className="text-xs text-slate-500">{formatNumber(avg.totalAmt)}</div>
                                </td>
                              </tr>
                              {/* Percentage row */}
                              <tr className="border-b border-slate-300 bg-slate-50">
                                <td className="px-3 py-2 text-slate-600 border-r border-slate-200">%</td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">{pct.confirmed}%</td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">{pct.packaging}%</td>
                                <td className="px-3 py-2 text-center text-yellow-600 border-r border-slate-200">{pct.shipping}%</td>
                                <td className="px-3 py-2 text-center border-r border-slate-200">{pct.failed}%</td>
                                <td className="px-3 py-2 text-center text-green-600 border-r border-slate-200">{pct.completed}%</td>
                                <td className="px-3 py-2 text-center text-red-600 border-r border-slate-200">{pct.cancelled}%</td>
                                <td className="px-3 py-2 text-center text-orange-600 border-r border-slate-200">{pct.returns}%</td>
                                <td className="px-3 py-2 text-center text-blue-600">100%</td>
                              </tr>
                            </>
                          );
                        })()}
                        {/* Daily rows */}
                        {data.dailyStatusStats.map((day) => {
                          const dayTotal = day.totalCount;
                          const completedPct = dayTotal > 0 ? (day.completedCount / dayTotal * 100).toFixed(2) : '0';
                          const cancelledPct = dayTotal > 0 ? (day.cancelledCount / dayTotal * 100).toFixed(2) : '0';
                          const returnsPct = dayTotal > 0 ? (day.returnsCount / dayTotal * 100).toFixed(2) : '0';
                          return (
                            <tr key={day.date} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-600 border-r border-slate-200">{formatDate(day.date)}</td>
                              <td className="px-3 py-2 text-center border-r border-slate-200">
                                {day.confirmedCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.confirmedCount)}</div>
                                    <div className="text-xs text-slate-500">{formatNumber(day.confirmedAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center border-r border-slate-200">
                                {day.packagingCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.packagingCount)}</div>
                                    <div className="text-xs text-slate-500">{formatNumber(day.packagingAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-yellow-600 border-r border-slate-200">
                                {day.shippingCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.shippingCount)}</div>
                                    <div className="text-xs text-yellow-500">{formatNumber(day.shippingAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center border-r border-slate-200">
                                {day.failedCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.failedCount)}</div>
                                    <div className="text-xs text-slate-500">{formatNumber(day.failedAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-green-600 border-r border-slate-200">
                                {day.completedCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.completedCount)} <span className="text-xs">({completedPct}%)</span></div>
                                    <div className="text-xs text-green-500">{formatNumber(day.completedAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-red-600 border-r border-slate-200">
                                {day.cancelledCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.cancelledCount)} <span className="text-xs">({cancelledPct}%)</span></div>
                                    <div className="text-xs text-red-500">{formatNumber(day.cancelledAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-orange-600 border-r border-slate-200">
                                {day.returnsCount > 0 ? (
                                  <>
                                    <div>{formatNumber(day.returnsCount)} <span className="text-xs">({returnsPct}%)</span></div>
                                    <div className="text-xs text-orange-500">{formatNumber(day.returnsAmount)}</div>
                                  </>
                                ) : '-'}
                              </td>
                              <td className="px-3 py-2 text-center text-blue-600">
                                <div>{formatNumber(day.totalCount)}</div>
                                <div className="text-xs text-blue-500">{formatNumber(day.totalAmount)}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Lý do khách hủy */}
        <TabsContent value="cancel" className="mt-4">
          {/* Date filter */}
          <Card className="mb-4">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />
                <div className="flex-1" />
                <div className="text-sm text-slate-500">
                  Tổng đơn hủy: <span className="font-medium text-red-600">{formatNumber(data.totals.cancelled)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="h-[300px] flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
          ) : data.cancelReasons.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <CheckCircle className="w-12 h-12 mb-2 text-green-300" />
                  <p>Không có đơn hủy trong khoảng thời gian này</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Table 1: Báo cáo số đơn */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Báo cáo số đơn ứng với lý do khách hủy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Lý do hủy</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Hệ thống hủy</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Đã hoàn</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Tổng số</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cancelReasons.map((reason) => (
                          <tr key={reason.reason} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4">{reason.reason}</td>
                            <td className="py-3 px-4 text-right text-red-600">{formatNumber(reason.systemCount ?? 0)}</td>
                            <td className="py-3 px-4 text-right text-orange-600">{formatNumber(reason.returnedCount ?? 0)}</td>
                            <td className="py-3 px-4 text-right font-medium">{formatNumber(reason.totalCount ?? 0)}</td>
                          </tr>
                        ))}
                        {/* Total row */}
                        <tr className="bg-slate-50 font-medium">
                          <td className="py-3 px-4">Tổng cộng</td>
                          <td className="py-3 px-4 text-right text-red-600">
                            {formatNumber(data.cancelReasons.reduce((sum, r) => sum + (r.systemCount ?? 0), 0))}
                          </td>
                          <td className="py-3 px-4 text-right text-orange-600">
                            {formatNumber(data.cancelReasons.reduce((sum, r) => sum + (r.returnedCount ?? 0), 0))}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatNumber(data.cancelReasons.reduce((sum, r) => sum + (r.totalCount ?? 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Table 2: Báo cáo phần trăm */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Báo cáo phần trăm đơn hàng khách hủy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Lý do hủy</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Hệ thống hủy</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Đã hoàn</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-600">Tổng số</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cancelReasons.map((reason) => (
                          <tr key={reason.reason} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4">{reason.reason}</td>
                            <td className="py-3 px-4 text-right text-red-600">{reason.systemPercent ?? 0}%</td>
                            <td className="py-3 px-4 text-right text-orange-600">{reason.returnedPercent ?? 0}%</td>
                            <td className="py-3 px-4 text-right font-medium">{reason.totalPercent ?? 0}%</td>
                          </tr>
                        ))}
                        {/* Total row */}
                        <tr className="bg-slate-50 font-medium">
                          <td className="py-3 px-4">Tổng cộng</td>
                          <td className="py-3 px-4 text-right text-red-600">
                            {data.cancelReasons.reduce((sum, r) => sum + (r.systemPercent ?? 0), 0).toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right text-orange-600">
                            {data.cancelReasons.reduce((sum, r) => sum + (r.returnedPercent ?? 0), 0).toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
