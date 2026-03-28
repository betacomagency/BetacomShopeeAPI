/**
 * Activity Tab — User activity timeline, by user, by category
 */
import { useState } from 'react';
import { useUserActivity } from '@/hooks/monitoring/use-user-activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { formatDistanceToNow } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const TIME_RANGES = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

export function ActivityTab() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, error } = useUserActivity(hours);

  if (isLoading) return <Spinner className="mt-8" />;
  if (error) return <p className="text-destructive">Error: {(error as Error).message}</p>;
  if (!data) return null;

  const pieData = data.by_category.map((c) => ({ name: c.category, value: c.total }));

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* By category chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">By Category</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-2">
                {pieData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users summary */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Users</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">Actions</th>
                  <th className="pb-2 pr-4">Errors</th>
                  <th className="pb-2">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {data.by_user.map((u) => (
                  <tr key={u.user_id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{u.user_name}</td>
                    <td className="py-2 pr-4">{u.total_actions}</td>
                    <td className="py-2 pr-4">{u.errors > 0 ? <Badge variant="destructive">{u.errors}</Badge> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="py-2 text-muted-foreground">{formatDistanceToNow(new Date(u.last_action), { addSuffix: true })}</td>
                  </tr>
                ))}
                {data.by_user.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No user activity</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {data.timeline.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent/50">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{item.user_name || item.user_email || 'system'}</span>
                <Badge variant={item.status === 'success' ? 'default' : item.status === 'failed' ? 'destructive' : 'secondary'}>{item.status}</Badge>
                <span className="text-xs text-muted-foreground">{item.action_category}</span>
                <span className="flex-1 truncate">{item.action_description}</span>
                {item.duration_ms != null && <span className="text-xs text-muted-foreground">{item.duration_ms}ms</span>}
              </div>
            ))}
            {data.timeline.length === 0 && <div className="py-8 text-center text-muted-foreground">No activity in this period</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
