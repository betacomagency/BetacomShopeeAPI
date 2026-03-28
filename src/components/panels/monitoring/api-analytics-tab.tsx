/**
 * API Analytics Tab — Calls/hour chart, error rate, top errors, by function
 */
import { useState } from 'react';
import { useApiAnalytics } from '@/hooks/monitoring/use-api-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const TIME_RANGES = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

export function ApiAnalyticsTab() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, error } = useApiAnalytics(hours);

  if (isLoading) return <Spinner className="mt-8" />;
  if (error) return <p className="text-destructive">Error: {(error as Error).message}</p>;
  if (!data) return null;

  const chartData = data.calls_per_hour.map((h) => ({
    ...h,
    hour: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setHours(r.value)}
            className={`cursor-pointer rounded px-3 py-1 text-xs transition-colors ${
              hours === r.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Total Calls</div>
          <div className="mt-1 text-2xl font-semibold">{data.summary.total_calls.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Success Rate</div>
          <div className="mt-1 text-2xl font-semibold">{(100 - (data.summary.error_rate ?? 0)).toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">{data.summary.success.toLocaleString()} successful</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Errors</div>
          <div className="mt-1 text-2xl font-semibold text-destructive">{data.summary.failed + data.summary.timeout}</div>
          <div className="text-xs text-muted-foreground">{data.summary.error_rate ?? 0}% error rate</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Avg Latency</div>
          <div className="mt-1 text-2xl font-semibold">{data.summary.avg_duration_ms ?? 0}ms</div>
          <div className="text-xs text-muted-foreground">p95: {data.summary.p95_duration_ms ?? 0}ms</div>
        </CardContent></Card>
      </div>

      {/* Calls per hour chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Calls per Hour</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="success" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Success" />
                <Line type="monotone" dataKey="failed" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* By function */}
      {data.by_function.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">By Function</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(150, data.by_function.length * 35)}>
              <BarChart data={data.by_function} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="edge_function" className="text-xs" width={160} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top errors */}
      {data.top_errors.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Top Errors</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Error</th>
                  <th className="pb-2 pr-4">Message</th>
                  <th className="pb-2 pr-4">Count</th>
                  <th className="pb-2">Function</th>
                </tr>
              </thead>
              <tbody>
                {data.top_errors.map((err, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs"><Badge variant="destructive">{err.error}</Badge></td>
                    <td className="py-2 pr-4 text-muted-foreground max-w-xs truncate">{err.message}</td>
                    <td className="py-2 pr-4 font-semibold">{err.count}</td>
                    <td className="py-2 text-xs text-muted-foreground">{err.edge_function}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
