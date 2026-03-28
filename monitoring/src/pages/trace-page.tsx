import { useState } from 'react';
import { useRequestTrace } from '@/hooks/use-request-trace';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { Search } from 'lucide-react';

export function TracePage() {
  const [input, setInput] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const { data, isLoading, error } = useRequestTrace(requestId);

  const handleSearch = () => {
    const trimmed = input.trim();
    if (trimmed.length > 0) setRequestId(trimmed);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Request Trace</h2>

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter request ID (UUID)..."
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleSearch}
          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-100 transition-colors hover:bg-zinc-600"
        >
          <Search className="h-4 w-4" />
          Trace
        </button>
      </div>

      {isLoading && <LoadingSpinner text="Tracing request..." />}
      {error && <div className="text-red-400">Error: {(error as Error).message}</div>}

      {data && (
        <>
          {/* Summary */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-1 text-xs text-zinc-500">Request ID</div>
            <div className="font-mono text-sm text-zinc-300">{requestId}</div>
            <div className="mt-2 text-xs text-zinc-500">
              {data.api_calls.length} API call(s), {data.activities.length} activity log(s)
            </div>
          </div>

          {/* API Calls chain */}
          {data.api_calls.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">API Call Chain</h3>
              <div className="space-y-3">
                {data.api_calls.map((call, i) => (
                  <div key={call.id} className="relative border-l-2 border-zinc-700 pl-4">
                    <div className="absolute -left-1.5 top-1 h-2.5 w-2.5 rounded-full bg-zinc-600" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">{i + 1}.</span>
                      <span className="font-mono text-xs text-blue-400">{call.edge_function}</span>
                      <StatusBadge status={call.status} />
                      {call.duration_ms && <span className="text-xs text-zinc-500">{call.duration_ms}ms</span>}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {call.http_method} {call.api_endpoint}
                    </div>
                    {call.shopee_error && (
                      <div className="mt-1 text-xs text-red-400">
                        {call.shopee_error}: {call.shopee_message}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-zinc-600">
                      {new Date(call.created_at).toLocaleString()} | shop: {call.shop_id} | by: {call.user_email || call.triggered_by}
                    </div>

                    {/* Expandable raw data */}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">Raw data</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">
                        {JSON.stringify({ params: call.request_params, response: call.response_summary }, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {data.activities.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-300">Activity Logs</h3>
              <div className="space-y-2">
                {data.activities.map((act) => (
                  <div key={act.id} className="flex items-center gap-3 text-sm">
                    <StatusBadge status={act.status} />
                    <span className="text-zinc-300">{act.action_description}</span>
                    <span className="text-xs text-zinc-500">{act.user_name || '-'}</span>
                    {act.duration_ms && <span className="text-xs text-zinc-600">{act.duration_ms}ms</span>}
                    <span className="text-xs text-zinc-600">{new Date(act.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.api_calls.length === 0 && data.activities.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">
              No traces found for this request ID
            </div>
          )}
        </>
      )}

      {!requestId && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-600">
          Enter a request ID to trace the full request chain
        </div>
      )}
    </div>
  );
}
