/**
 * ActivityTrendChart - Biểu đồ đường hiển thị xu hướng hoạt động theo ngày
 * Hiển thị: đăng nhập, truy cập chức năng, thao tác trên hệ thống
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Payload } from 'recharts/types/component/DefaultTooltipContent';
import { ChevronDown, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DailyActivityStats {
  date: string;
  logins: number;
  ads: number;
  reviews: number;
  flash_sale: number;
  orders: number;
  products: number;
  system: number;
  total: number;
}

interface ActivityTrendChartProps {
  data: DailyActivityStats[];
  loading?: boolean;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const DATE_RANGE_OPTIONS: Record<string, string> = {
  '7': '7 ngày qua',
  '14': '14 ngày qua',
  '30': '30 ngày qua',
  '90': '90 ngày qua',
};

const LINE_COLORS = {
  logins: '#EF4444', // red
  ads: '#A855F7', // purple
  reviews: '#EAB308', // yellow
  flash_sale: '#F97316', // orange
  orders: '#3B82F6', // blue
  products: '#22C55E', // green
  system: '#64748B', // slate
};

const LINE_LABELS: Record<string, string> = {
  logins: 'Đăng nhập',
  ads: 'Quảng cáo',
  reviews: 'Đánh giá',
  flash_sale: 'Flash Sale',
  orders: 'Đơn hàng',
  products: 'Sản phẩm',
  system: 'Hệ thống',
};

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

// Custom tooltip
interface ChartDataPayload extends DailyActivityStats {
  displayDate: string;
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

  // Sort by value descending
  const sortedPayload = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[200px]">
      <p className="text-sm font-medium text-slate-700 mb-2 border-b pb-2">{formattedDate}</p>
      <div className="space-y-1.5">
        {sortedPayload.map((entry: Payload<number, string>, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-slate-600">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-slate-800">
              {Number(entry.value || 0).toLocaleString('vi-VN')}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-2 border-t mt-2">
          <span className="text-sm font-medium text-slate-700">Tổng</span>
          <span className="text-sm font-bold text-slate-900">
            {dataPayload?.total?.toLocaleString('vi-VN') || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom legend with toggle
interface CustomLegendProps {
  visibleLines: Set<string>;
  onToggle: (key: string) => void;
}

function CustomLegend({ visibleLines, onToggle }: CustomLegendProps) {
  const items = Object.entries(LINE_LABELS).map(([key, name]) => ({
    key,
    name,
    color: LINE_COLORS[key as keyof typeof LINE_COLORS],
  }));

  return (
    <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onToggle(item.key)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all cursor-pointer',
            visibleLines.has(item.key)
              ? 'bg-slate-100 hover:bg-slate-200'
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          )}
        >
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-opacity',
              !visibleLines.has(item.key) && 'opacity-30'
            )}
            style={{ backgroundColor: item.color }}
          />
          <span className={cn(!visibleLines.has(item.key) && 'line-through')}>
            {item.name}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ActivityTrendChart({
  data,
  loading,
  dateRange,
  onDateRangeChange,
}: ActivityTrendChartProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    new Set(['logins', 'ads', 'orders', 'products'])
  );

  const toggleLine = (key: string) => {
    setVisibleLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't allow hiding all lines
        if (next.size > 1) {
          next.delete(key);
        }
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Transform data for chart
  const chartData = useMemo(() => {
    return data.map((day) => ({
      ...day,
      displayDate: formatDate(day.date),
    }));
  }, [data]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data.length) return null;

    const totals = data.reduce(
      (acc, day) => ({
        logins: acc.logins + day.logins,
        operations: acc.operations + day.total - day.logins,
        total: acc.total + day.total,
      }),
      { logins: 0, operations: 0, total: 0 }
    );

    const avgPerDay = Math.round(totals.total / data.length);

    return { ...totals, avgPerDay };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-100 rounded w-48 animate-pulse" />
        </div>
        <div className="p-4 h-[380px] flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tải biểu đồ...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          <h2 className="font-semibold text-slate-800">Xu hướng hoạt động theo ngày</h2>
        </div>

        <div className="flex items-center gap-4">
          {/* Summary Stats */}
          {summaryStats && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="text-slate-500">
                Đăng nhập: <span className="font-medium text-red-600">{summaryStats.logins.toLocaleString('vi-VN')}</span>
              </div>
              <div className="text-slate-500">
                Thao tác: <span className="font-medium text-blue-600">{summaryStats.operations.toLocaleString('vi-VN')}</span>
              </div>
              <div className="text-slate-500">
                TB/ngày: <span className="font-medium text-slate-700">{summaryStats.avgPerDay}</span>
              </div>
            </div>
          )}

          {/* Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="text-slate-600">{DATE_RANGE_OPTIONS[dateRange] || '7 ngày qua'}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {showDatePicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDatePicker(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                  {Object.entries(DATE_RANGE_OPTIONS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        onDateRangeChange(key);
                        setShowDatePicker(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer',
                        dateRange === key && 'bg-purple-50 text-purple-600 font-medium'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            Chưa có dữ liệu hoạt động
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
                <XAxis
                  dataKey="displayDate"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  dx={-5}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Lines */}
                {visibleLines.has('logins') && (
                  <Line
                    type="monotone"
                    dataKey="logins"
                    name="Đăng nhập"
                    stroke={LINE_COLORS.logins}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.logins }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {visibleLines.has('ads') && (
                  <Line
                    type="monotone"
                    dataKey="ads"
                    name="Quảng cáo"
                    stroke={LINE_COLORS.ads}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.ads }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {visibleLines.has('reviews') && (
                  <Line
                    type="monotone"
                    dataKey="reviews"
                    name="Đánh giá"
                    stroke={LINE_COLORS.reviews}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.reviews }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {visibleLines.has('flash_sale') && (
                  <Line
                    type="monotone"
                    dataKey="flash_sale"
                    name="Flash Sale"
                    stroke={LINE_COLORS.flash_sale}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.flash_sale }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {visibleLines.has('orders') && (
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Đơn hàng"
                    stroke={LINE_COLORS.orders}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.orders }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {visibleLines.has('products') && (
                  <Line
                    type="monotone"
                    dataKey="products"
                    name="Sản phẩm"
                    stroke={LINE_COLORS.products}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.products }}
                    activeDot={{ r: 5 }}
                  />
                )}
                {visibleLines.has('system') && (
                  <Line
                    type="monotone"
                    dataKey="system"
                    name="Hệ thống"
                    stroke={LINE_COLORS.system}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS.system }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>

            {/* Legend with toggle */}
            <CustomLegend visibleLines={visibleLines} onToggle={toggleLine} />
          </>
        )}
      </div>
    </div>
  );
}
