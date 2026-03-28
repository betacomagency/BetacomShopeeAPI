/**
 * Health Tab — Worker status, Edge Functions, Token health, Cron jobs
 */
import { useSystemHealth } from '@/hooks/monitoring/use-system-health';
import { useRealtimeHealth } from '@/hooks/monitoring/use-realtime-health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Server, Key, Zap } from 'lucide-react';

function StatusDot({ status }: { status: string }) {
  const color = status === 'healthy' || status === 'success' ? 'bg-emerald-500'
    : status === 'degraded' || status === 'warning' ? 'bg-amber-500'
    : status === 'down' || status === 'failed' ? 'bg-red-500'
    : 'bg-zinc-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function StatBox({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function HealthTab() {
  const { data, isLoading, error } = useSystemHealth();
  useRealtimeHealth();

  if (isLoading) return <Spinner className="mt-8" />;
  if (error) return <p className="text-destructive">Error: {(error as Error).message}</p>;
  if (!data) return null;

  const worker = data.worker;
  const workerStatus = worker?.is_stale ? 'down' : (worker?.status ?? 'unknown');
  const crons = (worker?.metadata as Record<string, unknown>)?.crons as Record<string, Record<string, unknown>> | undefined;

  return (
    <div className="space-y-4">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox
          label="Worker"
          value={workerStatus.toUpperCase()}
          sub={worker?.last_heartbeat ? `Heartbeat ${formatDistanceToNow(new Date(worker.last_heartbeat), { addSuffix: true })}` : 'No data'}
          icon={<Server className="h-5 w-5" />}
        />
        <StatBox
          label="Edge Functions"
          value={`${data.edge_functions.length} active`}
          sub={`${data.edge_functions.reduce((s, f) => s + f.last_24h_errors, 0)} errors (24h)`}
          icon={<Zap className="h-5 w-5" />}
        />
        <StatBox
          label="Tokens"
          value={data.tokens.total}
          sub={`${data.tokens.expired} expired, ${data.tokens.expiring_soon} expiring`}
          icon={<Key className="h-5 w-5" />}
        />
        <StatBox
          label="Uptime"
          value={worker?.metadata ? `${Math.floor((worker.metadata as Record<string, number>).uptime_s / 3600)}h` : 'N/A'}
          sub={worker?.metadata ? `${(worker.metadata as Record<string, number>).memory_mb}MB heap` : ''}
          icon={<Heart className="h-5 w-5" />}
        />
      </div>

      {/* Cron Jobs */}
      {crons && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cron Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Job</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Last Run</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">Runs</th>
                    <th className="pb-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(crons).map(([name, s]) => (
                    <tr key={name} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{name}</td>
                      <td className="py-2 pr-4"><StatusDot status={(s.lastStatus as string) ?? 'unknown'} /> <span className="ml-1 text-xs">{(s.lastStatus as string) ?? 'unknown'}</span></td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.lastRun ? formatDistanceToNow(new Date(s.lastRun as string), { addSuffix: true }) : 'N/A'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{s.lastDurationMs != null ? `${s.lastDurationMs}ms` : '-'}</td>
                      <td className="py-2 pr-4">{s.runCount as number}</td>
                      <td className="py-2">{s.errorCount as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edge Functions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Edge Functions (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Function</th>
                  <th className="pb-2 pr-4">Last Call</th>
                  <th className="pb-2 pr-4">Calls</th>
                  <th className="pb-2 pr-4">Errors</th>
                  <th className="pb-2">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {data.edge_functions.map((fn) => (
                  <tr key={fn.function} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{fn.function}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{formatDistanceToNow(new Date(fn.last_call), { addSuffix: true })}</td>
                    <td className="py-2 pr-4">{fn.last_24h_calls.toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      {fn.last_24h_errors > 0 ? (
                        <Badge variant="destructive">{fn.last_24h_errors} ({((fn.last_24h_errors / fn.last_24h_calls) * 100).toFixed(1)}%)</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">{fn.avg_duration_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
