import { useState } from 'react';
import { useApiAnalytics } from '@/hooks/use-api-analytics';
import { StatCard } from '@/components/shared/stat-card';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { BarChart3, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const TIME_RANGES = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

export function ApiAnalyticsPage() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, error } = useApiAnalytics(hours);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const chartData = data.calls_per_hour.map((h) => ({
    ...h,
    hour: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">API Analytics</h2>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setHours(r.value)}
              className={`cursor-pointer rounded px-3 py-1 text-xs transition-colors ${
                hours === r.value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={data.summary.total_calls.toLocaleString()} icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard
          label="Success Rate"
          value={`${(100 - (data.summary.error_rate ?? 0)).toFixed(1)}%`}
          sub={`${data.summary.success.toLocaleString()} successful`}
          icon={<CheckCircle className="h-5 w-5" />}
          variant={data.summary.error_rate > 5 ? 'danger' : data.summary.error_rate > 1 ? 'warning' : 'success'}
        />
        <StatCard
          label="Errors"
          value={data.summary.failed + data.summary.timeout}
          sub={`${data.summary.error_rate ?? 0}% error rate`}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={data.summary.failed > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Avg Latency"
          value={`${data.summary.avg_duration_ms ?? 0}ms`}
          sub={`p95: ${data.summary.p95_duration_ms ?? 0}ms`}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Calls per hour chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Calls per Hour</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="hour" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By function chart */}
      {data.by_function.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">By Function</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_function} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" stroke="#71717a" fontSize={11} />
              <YAxis type="category" dataKey="edge_function" stroke="#71717a" fontSize={10} width={160} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top errors */}
      {data.top_errors.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Top 10 Errors</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4">Error</th>
                <th className="pb-2 pr-4">Message</th>
                <th className="pb-2 pr-4">Count</th>
                <th className="pb-2">Function</th>
              </tr>
            </thead>
            <tbody>
              {data.top_errors.map((err, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-xs text-red-400">{err.error}</td>
                  <td className="py-2 pr-4 text-zinc-400 max-w-xs truncate">{err.message}</td>
                  <td className="py-2 pr-4 font-semibold">{err.count}</td>
                  <td className="py-2 text-zinc-400 text-xs">{err.edge_function}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
