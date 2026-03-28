/**
 * Business Tab — Shops, Flash Sales, Token Refresh, Job Queue
 */
import { useBusinessMetrics } from '@/hooks/monitoring/use-business-metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

export function BusinessTab() {
  const { data, isLoading, error } = useBusinessMetrics();

  if (isLoading) return <Spinner className="mt-8" />;
  if (error) return <p className="text-destructive">Error: {(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Shops</div>
          <div className="mt-1 text-2xl font-semibold">{data.shops.total}</div>
          <div className="text-xs text-muted-foreground">{data.shops.active} active, {data.shops.inactive} inactive</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Flash Sales (Today)</div>
          <div className="mt-1 text-2xl font-semibold">{data.flash_sales.today.total}</div>
          <div className="text-xs text-muted-foreground">{data.flash_sales.today.success} ok, {data.flash_sales.today.failed} fail, {data.flash_sales.today.pending} pending</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Token Refresh (24h)</div>
          <div className="mt-1 text-2xl font-semibold">{data.token_refresh.last_24h.success + data.token_refresh.last_24h.failed}</div>
          <div className="text-xs text-muted-foreground">{data.token_refresh.last_24h.success} ok, {data.token_refresh.last_24h.failed} fail</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Success Rate (7d)</div>
          <div className="mt-1 text-2xl font-semibold">{data.flash_sales.success_rate != null ? `${data.flash_sales.success_rate}%` : 'N/A'}</div>
          <div className="text-xs text-muted-foreground">{data.flash_sales.week.success} / {data.flash_sales.week.total} jobs</div>
        </CardContent></Card>
      </div>

      {/* Flash Sales week */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Flash Sales (7 days)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.flash_sales.week.success}</div>
              <div className="text-xs text-muted-foreground">Success</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{data.flash_sales.week.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.flash_sales.week.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Queue */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Job Queue</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
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
                <tr key={row.status} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <Badge variant={row.status.includes('failed') ? 'destructive' : row.status.includes('success') ? 'default' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-2 font-semibold">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
