import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'border-zinc-800 bg-zinc-900',
  success: 'border-emerald-800/50 bg-emerald-950/30',
  warning: 'border-amber-800/50 bg-amber-950/30',
  danger: 'border-red-800/50 bg-red-950/30',
};

export function StatCard({ label, value, sub, icon, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', variantStyles[variant])}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{label}</span>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}
