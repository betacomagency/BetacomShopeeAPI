import { formatDistanceToNow } from 'date-fns';

export function TimeAgo({ date }: { date: string | null }) {
  if (!date) return <span className="text-zinc-600">N/A</span>;
  return (
    <span title={new Date(date).toLocaleString()}>
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </span>
  );
}
