/**
 * RevenueChart - Bar chart showing revenue over time
 */

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Payload } from 'recharts/types/component/DefaultTooltipContent';
import { ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyStats } from '@/hooks/useDashboardData';
import type { DateRangeOption } from '@/hooks/useDashboardData';
import { DATE_RANGE_LABELS } from '@/hooks/useDashboardData';

interface RevenueChartProps {
  data: DailyStats[];
  loading?: boolean;
  dateRange: DateRangeOption;
  onDateRangeChange: (range: DateRangeOption) => void;
}

// Format number with Vietnamese locale (in millions)
function formatMillions(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(0)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
  return num.toString();
}

function formatFullNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

// Custom tooltip
interface ChartDataPayload {
  date: string;
  displayDate: string;
  Shopee: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Payload<number, string>[] }) {
  if (!active || !payload || !payload.length) return null;

  // Get the original date from payload data (YYYY-MM-DD format)
  const dataPayload = payload[0]?.payload as ChartDataPayload | undefined;
  const originalDate = dataPayload?.date;

  let formattedDate = 'N/A';
  if (originalDate) {
    const date = new Date(originalDate + 'T00:00:00'); // Add time to prevent timezone issues
    formattedDate = date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium text-slate-700 mb-2">{formattedDate}</p>
      <div className="space-y-1.5">
        {payload.map((entry: Payload<number, string>, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-slate-600">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-slate-800">
              {formatFullNumber(Number(entry.value || 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Custom legend
function CustomLegend() {
  const items = [
    { name: 'Shopee', color: '#F97316' },
  ];

  return (
    <div className="flex items-center justify-center gap-6 pt-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-sm text-slate-600">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({
  data,
  loading,
  dateRange,
  onDateRangeChange,
}: RevenueChartProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Transform data for chart
  const chartData = data.map((day) => ({
    date: day.date,
    displayDate: formatDate(day.date),
    Shopee: day.revenue,
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="h-6 bg-slate-100 rounded w-40 animate-pulse" />
        </div>
        <div className="p-4 h-[350px] flex items-center justify-center">
          <div className="text-slate-400">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Doanh thu theo thời gian</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="text-slate-600">{DATE_RANGE_LABELS[dateRange]}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {showDatePicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDatePicker(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                  {(Object.keys(DATE_RANGE_LABELS) as DateRangeOption[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        onDateRangeChange(key);
                        setShowDatePicker(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer',
                        dateRange === key && 'bg-orange-50 text-orange-600 font-medium'
                      )}
                    >
                      {DATE_RANGE_LABELS[key]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button className="p-1.5 hover:bg-slate-100 rounded-md transition-colors cursor-pointer">
            <Settings className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            Chưa có dữ liệu
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              barCategoryGap="20%"
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
                tickFormatter={formatMillions}
                dx={-5}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
              <Legend content={<CustomLegend />} />
              <Bar
                dataKey="Shopee"
                fill="#F97316"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
