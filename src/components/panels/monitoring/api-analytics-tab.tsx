/**
 * API Analytics Tab — Overview charts + detailed error log with date picker
 */
import { useState } from 'react';
import { useApiAnalytics } from '@/hooks/monitoring/use-api-analytics';
import { useErrorLogs, type ErrorLogItem } from '@/hooks/monitoring/use-error-logs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const TIME_RANGES = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

/** Format timestamp to readable local time */
function formatTime(dateStr: string) {
  return format(new Date(dateStr), 'HH:mm:ss');
}
function formatDateTime(dateStr: string) {
  return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss');
}

/** Error detail modal/panel */
function ErrorDetail({ item, onClose }: { item: ErrorLogItem; onClose: () => void }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Error Detail</CardTitle>
          <button onClick={onClose} className="cursor-pointer rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Time: </span>
            <span className="font-mono">{formatDateTime(item.created_at)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Duration: </span>
            <span>{item.duration_ms ?? '-'}ms</span>
          </div>
          <div>
            <span className="text-muted-foreground">Function: </span>
            <span className="font-mono text-xs">{item.edge_function}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Endpoint: </span>
            <span className="font-mono text-xs">{item.http_method} {item.api_endpoint}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Shop ID: </span>
            <span>{item.shop_id ?? '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Triggered by: </span>
            <span>{item.triggered_by} {item.user_email ? `(${item.user_email})` : ''}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Error: </span>
            <Badge variant="destructive">{item.shopee_error}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground">HTTP Status: </span>
            <span>{item.http_status_code ?? '-'}</span>
          </div>
          {item.request_id && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Request ID: </span>
              <span className="font-mono text-xs">{item.request_id}</span>
            </div>
          )}
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Message: </span>
          <p className="mt-1 text-sm">{item.shopee_message ?? '-'}</p>
        </div>
        {item.request_params && (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Request Params</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(item.request_params, null, 2)}</pre>
          </details>
        )}
        {item.response_summary && (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Response Summary</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(item.response_summary, null, 2)}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function ApiAnalyticsTab() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, error } = useApiAnalytics(hours);

  // Error logs with filters
  const today = format(new Date(), 'yyyy-MM-dd');
  const [errorDate, setErrorDate] = useState(today);
  const [errorFnFilter, setErrorFnFilter] = useState<string | undefined>();
  const [errorPage, setErrorPage] = useState(1);
  const [selectedError, setSelectedError] = useState<ErrorLogItem | null>(null);
  const [shopIdFilter, setShopIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchFilter, setSearchFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const { data: errorLogs, isLoading: errLoading } = useErrorLogs({
    date: errorDate,
    edgeFunction: errorFnFilter,
    page: errorPage,
    shopId: shopIdFilter ? Number(shopIdFilter) : undefined,
    status: statusFilter,
    search: searchFilter || undefined,
  });

  // Navigate dates
  const prevDay = () => {
    const d = new Date(errorDate);
    d.setDate(d.getDate() - 1);
    setErrorDate(format(d, 'yyyy-MM-dd'));
    setErrorPage(1); setSelectedError(null);
  };
  const nextDay = () => {
    const d = new Date(errorDate);
    d.setDate(d.getDate() + 1);
    if (d <= new Date()) {
      setErrorDate(format(d, 'yyyy-MM-dd'));
      setErrorPage(1); setSelectedError(null);
    }
  };
  const resetFilters = () => {
    setErrorFnFilter(undefined); setShopIdFilter(''); setStatusFilter(undefined);
    setSearchFilter(''); setSearchInput(''); setErrorPage(1); setSelectedError(null);
  };

  if (isLoading) return <Spinner className="mt-8" />;
  if (error) return <p className="text-destructive">Error: {(error as Error).message}</p>;
  if (!data) return null;

  const chartData = data.calls_per_hour.map((h) => ({
    ...h,
    hour: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  const totalErrorPages = errorLogs ? Math.ceil(errorLogs.total / errorLogs.page_size) : 0;

  // Unique functions for filter
  const functions = data.by_function.map((f) => f.edge_function);

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

      {/* ==================== ERROR LOGS DETAIL ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Error Logs</CardTitle>
            <div className="flex items-center gap-1">
              <button onClick={prevDay} className="cursor-pointer rounded p-1 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
              <input
                type="date"
                value={errorDate}
                max={today}
                onChange={(e) => { setErrorDate(e.target.value); setErrorPage(1); setSelectedError(null); }}
                className="cursor-pointer rounded border border-input bg-background px-2 py-1 text-xs outline-none"
              />
              <button onClick={nextDay} className="cursor-pointer rounded p-1 hover:bg-accent" disabled={errorDate === today}><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          {/* Filter row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={errorFnFilter ?? ''}
              onChange={(e) => { setErrorFnFilter(e.target.value || undefined); setErrorPage(1); setSelectedError(null); }}
              className="cursor-pointer rounded border border-input bg-background px-2 py-1 text-xs outline-none"
            >
              <option value="">All Functions</option>
              {functions.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
            </select>
            <select
              value={statusFilter ?? ''}
              onChange={(e) => { setStatusFilter(e.target.value || undefined); setErrorPage(1); setSelectedError(null); }}
              className="cursor-pointer rounded border border-input bg-background px-2 py-1 text-xs outline-none"
            >
              <option value="">Errors only</option>
              <option value="failed">Failed</option>
              <option value="timeout">Timeout</option>
              <option value="success">Success</option>
            </select>
            <input
              type="text"
              value={shopIdFilter}
              onChange={(e) => { setShopIdFilter(e.target.value.replace(/\D/g, '')); setErrorPage(1); setSelectedError(null); }}
              placeholder="Shop ID"
              className="w-24 rounded border border-input bg-background px-2 py-1 text-xs outline-none"
            />
            <form
              className="flex"
              onSubmit={(e) => { e.preventDefault(); setSearchFilter(searchInput); setErrorPage(1); setSelectedError(null); }}
            >
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search error/endpoint..."
                className="w-40 rounded-l border border-input bg-background px-2 py-1 text-xs outline-none"
              />
              <button type="submit" className="cursor-pointer rounded-r border border-l-0 border-input bg-muted px-2 py-1 text-xs hover:bg-accent">
                Search
              </button>
            </form>
            {(errorFnFilter || statusFilter || shopIdFilter || searchFilter) && (
              <button onClick={resetFilters} className="cursor-pointer rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                Clear filters
              </button>
            )}
          </div>
          {errorLogs && <p className="mt-2 text-xs text-muted-foreground">{errorLogs.total} log(s) on {errorDate}</p>}
        </CardHeader>
        <CardContent>
          {errLoading && <Spinner className="mt-4" />}

          {/* Selected error detail */}
          {selectedError && <ErrorDetail item={selectedError} onClose={() => setSelectedError(null)} />}

          {/* Error list table */}
          {errorLogs && errorLogs.items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3">Time</th>
                      <th className="pb-2 pr-3">Function</th>
                      <th className="pb-2 pr-3">Endpoint</th>
                      <th className="pb-2 pr-3">Error</th>
                      <th className="pb-2 pr-3">Shop</th>
                      <th className="pb-2 pr-3">Duration</th>
                      <th className="pb-2">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorLogs.items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedError(item)}
                        className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50 ${
                          selectedError?.id === item.id ? 'bg-accent/30' : ''
                        }`}
                      >
                        <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{formatTime(item.created_at)}</td>
                        <td className="py-2 pr-3 font-mono text-xs max-w-[120px] truncate">{item.edge_function}</td>
                        <td className="py-2 pr-3 text-xs max-w-[180px] truncate text-muted-foreground">{item.api_endpoint}</td>
                        <td className="py-2 pr-3"><Badge variant="destructive" className="text-xs">{item.shopee_error}</Badge></td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{item.shop_id ?? '-'}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{item.duration_ms ?? '-'}ms</td>
                        <td className="py-2 text-xs text-muted-foreground">{item.triggered_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalErrorPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Page {errorPage} / {totalErrorPages} ({errorLogs.total} total)</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setErrorPage((p) => Math.max(1, p - 1)); setSelectedError(null); }}
                      disabled={errorPage <= 1}
                      className="cursor-pointer rounded border px-2 py-1 hover:bg-accent disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => { setErrorPage((p) => Math.min(totalErrorPages, p + 1)); setSelectedError(null); }}
                      disabled={errorPage >= totalErrorPages}
                      className="cursor-pointer rounded border px-2 py-1 hover:bg-accent disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {errorLogs && errorLogs.items.length === 0 && !errLoading && (
            <p className="py-6 text-center text-muted-foreground">No errors on {errorDate}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
