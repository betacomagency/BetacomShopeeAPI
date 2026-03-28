import { useState } from 'react';
import { useUserActivity } from '@/hooks/use-user-activity';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { TimeAgo } from '@/components/shared/time-ago';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TIME_RANGES = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

export function ActivityPage() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, error } = useUserActivity(hours);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const pieData = data.by_category.map((c) => ({ name: c.category, value: c.total }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">User Activity</h2>
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

      <div className="grid grid-cols-3 gap-4">
        {/* By category chart */}
        {pieData.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">By Category</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              {pieData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1 text-xs text-zinc-400">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  {d.name}: {d.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Users summary */}
        <div className="col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">Users</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Actions</th>
                <th className="pb-2 pr-4">Errors</th>
                <th className="pb-2">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {data.by_user.map((u) => (
                <tr key={u.user_id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 text-zinc-300">{u.user_name}</td>
                  <td className="py-2 pr-4">{u.total_actions}</td>
                  <td className="py-2 pr-4">
                    <span className={u.errors > 0 ? 'text-red-400' : 'text-zinc-500'}>{u.errors}</span>
                  </td>
                  <td className="py-2 text-zinc-400"><TimeAgo date={u.last_action} /></td>
                </tr>
              ))}
              {data.by_user.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-zinc-600">No user activity</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Activity Timeline</h3>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {data.timeline.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded px-2 py-1.5 text-sm hover:bg-zinc-800/50">
              <span className="w-16 shrink-0 text-xs text-zinc-600">
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="w-28 shrink-0 text-xs text-zinc-400 truncate">{item.user_name || item.user_email || 'system'}</span>
              <StatusBadge status={item.status} />
              <span className="text-xs text-zinc-500">{item.action_category}</span>
              <span className="flex-1 truncate text-zinc-300">{item.action_description}</span>
              {item.duration_ms != null && (
                <span className="text-xs text-zinc-600">{item.duration_ms}ms</span>
              )}
            </div>
          ))}
          {data.timeline.length === 0 && (
            <div className="py-8 text-center text-zinc-600">No activity in this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
