/**
 * Trace Tab — Search by request_id and view full request chain
 */
import { useState } from 'react';
import { useRequestTrace } from '@/hooks/monitoring/use-request-trace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Search } from 'lucide-react';

export function TraceTab() {
  const [input, setInput] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const { data, isLoading, error } = useRequestTrace(requestId);

  const handleSearch = () => {
    const trimmed = input.trim();
    if (trimmed.length > 0) setRequestId(trimmed);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter request ID (UUID)..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <button
          onClick={handleSearch}
          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-4 w-4" />
          Trace
        </button>
      </div>

      {isLoading && <Spinner className="mt-4" />}
      {error && <p className="text-destructive">Error: {(error as Error).message}</p>}

      {data && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Request ID</div>
              <div className="font-mono text-sm">{requestId}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {data.api_calls.length} API call(s), {data.activities.length} activity log(s)
              </div>
            </CardContent>
          </Card>

          {/* API Calls chain */}
          {data.api_calls.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">API Call Chain</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.api_calls.map((call, i) => (
                    <div key={call.id} className="relative border-l-2 border-border pl-4">
                      <div className="absolute -left-1.5 top-1 h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{i + 1}.</span>
                        <span className="font-mono text-xs text-primary">{call.edge_function}</span>
                        <Badge variant={call.status === 'success' ? 'default' : 'destructive'}>{call.status}</Badge>
                        {call.duration_ms && <span className="text-xs text-muted-foreground">{call.duration_ms}ms</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{call.http_method} {call.api_endpoint}</div>
                      {call.shopee_error && <div className="mt-1 text-xs text-destructive">{call.shopee_error}: {call.shopee_message}</div>}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(call.created_at).toLocaleString()} | shop: {call.shop_id} | by: {call.user_email || call.triggered_by}
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Raw data</summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify({ params: call.request_params, response: call.response_summary }, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activities */}
          {data.activities.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Activity Logs</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.activities.map((act) => (
                    <div key={act.id} className="flex items-center gap-3 text-sm">
                      <Badge variant={act.status === 'success' ? 'default' : 'destructive'}>{act.status}</Badge>
                      <span>{act.action_description}</span>
                      <span className="text-xs text-muted-foreground">{act.user_name || '-'}</span>
                      {act.duration_ms && <span className="text-xs text-muted-foreground">{act.duration_ms}ms</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.api_calls.length === 0 && data.activities.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No traces found for this request ID</CardContent></Card>
          )}
        </>
      )}

      {!requestId && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Enter a request ID to trace the full request chain</CardContent></Card>
      )}
    </div>
  );
}
