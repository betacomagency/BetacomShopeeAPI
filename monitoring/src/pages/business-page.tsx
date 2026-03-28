import { useBusinessMetrics } from '@/hooks/use-business-metrics';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { Store, Zap, Key, ListTodo } from 'lucide-react';

export function BusinessPage() {
  const { data, isLoading, error } = useBusinessMetrics();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Business Metrics</h2>
        <span className="text-xs text-zinc-500">Auto-refresh: 60s</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Shops"
          value={data.shops.total}
          sub={`${data.shops.active} active, ${data.shops.inactive} inactive`}
          icon={<Store className="h-5 w-5" />}
          variant={data.shops.inactive > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Flash Sales (Today)"
          value={data.flash_sales.today.total}
          sub={`${data.flash_sales.today.success} ok, ${data.flash_sales.today.failed} fail, ${data.flash_sales.today.pending} pending`}
          icon={<Zap className="h-5 w-5" />}
          variant={data.flash_sales.today.failed > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Token Refresh (24h)"
          value={data.token_refresh.last_24h.success + data.token_refresh.last_24h.failed}
          sub={`${data.token_refresh.last_24h.success} ok, ${data.token_refresh.last_24h.failed} fail`}
          icon={<Key className="h-5 w-5" />}
          variant={data.token_refresh.last_24h.failed > 10 ? 'danger' : data.token_refresh.last_24h.failed > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Success Rate (7d)"
          value={data.flash_sales.success_rate != null ? `${data.flash_sales.success_rate}%` : 'N/A'}
          sub={`${data.flash_sales.week.success} / ${data.flash_sales.week.total} jobs`}
          icon={<ListTodo className="h-5 w-5" />}
          variant={(data.flash_sales.success_rate ?? 100) < 90 ? 'danger' : (data.flash_sales.success_rate ?? 100) < 95 ? 'warning' : 'success'}
        />
      </div>

      {/* Flash Sales week breakdown */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Flash Sales (7 days)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{data.flash_sales.week.success}</div>
            <div className="text-xs text-zinc-500">Success</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{data.flash_sales.week.failed}</div>
            <div className="text-xs text-zinc-500">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-zinc-300">{data.flash_sales.week.total}</div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
        </div>
      </div>

      {/* Job Queue */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Job Queue</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-500">
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Count</th>
            </tr>
          </thead>
          <tbody>
            {[
              { status: 'scheduled', count: data.jobs_queue.scheduled },
              { status: 'processing', count: data.jobs_queue.processing },
              { status: 'retry', count: data.jobs_queue.retry },
              { status: 'success (today)', count: data.jobs_queue.success_today },
              { status: 'failed (today)', count: data.jobs_queue.failed_today },
            ].map((row) => (
              <tr key={row.status} className="border-b border-zinc-800/50">
                <td className="py-2 pr-4">
                  <StatusBadge status={row.status.split(' ')[0]} />
                </td>
                <td className="py-2 font-semibold">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
