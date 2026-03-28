import { useSystemHealth } from '@/hooks/use-system-health';
import { useRealtimeHealth } from '@/hooks/use-realtime-health';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { TimeAgo } from '@/components/shared/time-ago';
import { Heart, Server, Key, Zap } from 'lucide-react';

export function HealthPage() {
  const { data, isLoading, error } = useSystemHealth();
  useRealtimeHealth();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const worker = data.worker;
  const workerStatus = worker?.is_stale ? 'down' : (worker?.status ?? 'unknown');
  const crons = (worker?.metadata as Record<string, unknown>)?.crons as Record<string, Record<string, unknown>> | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">System Health</h2>
        <span className="text-xs text-zinc-500">Auto-refresh: 30s</span>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Worker"
          value={workerStatus.toUpperCase()}
          sub={worker ? `Last heartbeat: ${new Date(worker.last_heartbeat!).toLocaleTimeString()}` : 'No data'}
          icon={<Server className="h-5 w-5" />}
          variant={workerStatus === 'healthy' ? 'success' : workerStatus === 'degraded' ? 'warning' : 'danger'}
        />
        <StatCard
          label="Edge Functions"
          value={`${data.edge_functions.length} active`}
          sub={`${data.edge_functions.reduce((s, f) => s + f.last_24h_errors, 0)} errors (24h)`}
          icon={<Zap className="h-5 w-5" />}
          variant={data.edge_functions.some(f => f.last_24h_errors > 0) ? 'warning' : 'success'}
        />
        <StatCard
          label="Tokens"
          value={`${data.tokens.total}`}
          sub={`${data.tokens.expired} expired, ${data.tokens.expiring_soon} expiring`}
          icon={<Key className="h-5 w-5" />}
          variant={data.tokens.expired > 0 ? 'danger' : data.tokens.expiring_soon > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Uptime"
          value={worker?.metadata ? `${Math.floor((worker.metadata as Record<string, number>).uptime_s / 3600)}h` : 'N/A'}
          sub={worker?.metadata ? `${(worker.metadata as Record<string, number>).memory_mb}MB heap` : ''}
          icon={<Heart className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Cron Jobs Status */}
      {crons && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Cron Jobs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="pb-2 pr-4">Job</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Last Run</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Runs</th>
                  <th className="pb-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(crons).map(([name, status]) => (
                  <tr key={name} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-4 font-mono text-xs">{name}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={(status.lastStatus as string) ?? 'unknown'} />
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">
                      <TimeAgo date={status.lastRun as string | null} />
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">
                      {status.lastDurationMs != null ? `${status.lastDurationMs}ms` : '-'}
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">{status.runCount as number}</td>
                    <td className="py-2 text-zinc-400">{status.errorCount as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edge Functions table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Edge Functions (24h)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4">Function</th>
                <th className="pb-2 pr-4">Last Call</th>
                <th className="pb-2 pr-4">Calls</th>
                <th className="pb-2 pr-4">Errors</th>
                <th className="pb-2">Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {data.edge_functions.map((fn) => (
                <tr key={fn.function} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-xs">{fn.function}</td>
                  <td className="py-2 pr-4 text-zinc-400">
                    <TimeAgo date={fn.last_call} />
                  </td>
                  <td className="py-2 pr-4">{fn.last_24h_calls.toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <span className={fn.last_24h_errors > 0 ? 'text-red-400' : 'text-zinc-400'}>
                      {fn.last_24h_errors} ({((fn.last_24h_errors / fn.last_24h_calls) * 100).toFixed(1)}%)
                    </span>
                  </td>
                  <td className="py-2 text-zinc-400">{fn.avg_duration_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
