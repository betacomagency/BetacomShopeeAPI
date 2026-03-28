import { cn } from '@/lib/cn';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  expiring_soon: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  down: 'bg-red-500/20 text-red-400 border-red-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  unknown: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = statusColors[status] ?? statusColors.unknown;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', colors, className)}>
      {status}
    </span>
  );
}
