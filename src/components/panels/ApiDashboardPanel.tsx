/**
 * API Dashboard Panel - Stats cards, trend chart, top failing endpoints
 */

import { useState, useEffect } from 'react';
import { useApiLogStats } from '@/hooks/useApiLogs';
import { supabase } from '@/lib/supabase';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const PERIOD_OPTIONS = [
  { value: '1', label: '24 giờ' },
  { value: '7', label: '7 ngày' },
  { value: '14', label: '14 ngày' },
  { value: '30', label: '30 ngày' },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  shop: 'Shop',
  product: 'Product',
  flash_sale: 'Flash Sale',
  review: 'Review',
  auth: 'Auth',
  order: 'Order',
  finance: 'Finance',
};

export function ApiDashboardPanel() {
  const [days, setDays] = useState(7);
  const [shopId, setShopId] = useState<number | undefined>(undefined);
  const [shops, setShops] = useState<Array<{ shop_id: number; shop_name: string | null }>>([]);
  const { data: stats, isLoading, refetch, isFetching } = useApiLogStats(shopId, days);

  useEffect(() => {
    supabase
      .from('apishopee_shops')
      .select('shop_id, shop_name')
      .order('shop_name')
      .then(({ data }) => {
        if (data) setShops(data);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>Chưa có dữ liệu API logs</p>
        <p className="text-sm mt-1">Dữ liệu sẽ xuất hiện khi có API calls được ghi log</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">API Overview</h2>
        <div className="flex items-center gap-2">
          {shops.length > 0 && (
            <Select
              value={shopId?.toString() || 'all'}
              onValueChange={(v) => setShopId(v === 'all' ? undefined : Number(v))}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Shop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">Tất cả shop</SelectItem>
                {shops.map((shop) => (
                  <SelectItem key={shop.shop_id} value={shop.shop_id.toString()} className="cursor-pointer">
                    {shop.shop_name || `Shop ${shop.shop_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={days.toString()} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-sm cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={Activity}
          label="Total Calls"
          value={formatNumber(stats.totalCalls)}
          color="text-blue-600 bg-blue-50"
        />
        <StatCard
          icon={CheckCircle}
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          color={stats.successRate >= 95 ? 'text-green-600 bg-green-50' : stats.successRate >= 80 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'}
          subtitle={`${stats.successCount} / ${stats.totalCalls}`}
        />
        <StatCard
          icon={XCircle}
          label="Failed Calls"
          value={formatNumber(stats.failedCount)}
          color={stats.failedCount > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={formatDuration(stats.avgDuration)}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      {/* Trend Chart */}
      {stats.callsOverTime.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">API Calls Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats.callsOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => {
                  const date = new Date(d);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
                tick={{ fontSize: 12 }}
                stroke="#94A3B8"
              />
              <YAxis width={40} tick={{ fontSize: 12 }} stroke="#94A3B8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="success"
                name="Success"
                stackId="1"
                stroke="#22C55E"
                fill="#22C55E"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="failed"
                name="Failed"
                stackId="1"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two-column: Category breakdown + Top failing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Calls by Category */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Calls by Category</h3>
          <div className="space-y-2">
            {stats.callsByCategory
              .sort((a, b) => b.count - a.count)
              .map((cat) => {
                const successRate = cat.count > 0 ? (cat.success_count / cat.count) * 100 : 0;
                return (
                  <div key={cat.api_category} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-24 truncate">
                      {CATEGORY_LABELS[cat.api_category] || cat.api_category}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${successRate}%`,
                          backgroundColor: successRate >= 95 ? '#22C55E' : successRate >= 80 ? '#EAB308' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-16 text-right">
                      {cat.count} calls
                    </span>
                  </div>
                );
              })}
            {stats.callsByCategory.length === 0 && (
              <p className="text-sm text-slate-400">No data</p>
            )}
          </div>
        </div>

        {/* Top Failing Endpoints */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Top Failing Endpoints
          </h3>
          <div className="space-y-2">
            {stats.topFailingEndpoints.map((ep, i) => (
              <div key={ep.api_endpoint} className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 w-5 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-slate-700 font-mono text-xs">{ep.api_endpoint}</p>
                  <p className="text-xs text-slate-400">
                    {ep.fail_count} fails / {ep.total_count} total ({ep.fail_rate.toFixed(0)}%)
                  </p>
                </div>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${ep.fail_rate > 50 ? 'text-red-500' : 'text-yellow-500'}`} />
              </div>
            ))}
            {stats.topFailingEndpoints.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Tất cả endpoints hoạt động tốt</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  const [bgColor, textColor] = color.split(' ');
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor || ''} ${textColor || ''}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
