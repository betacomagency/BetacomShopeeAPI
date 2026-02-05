/**
 * Dropdown component for Analytics Orders pages
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={cn('relative', className)}>
      {label && <div className="text-xs text-slate-500 mb-1">{label}</div>}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer bg-white min-w-[140px]"
      >
        <span className="text-slate-700">{selectedOption?.label}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 min-w-full">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer',
                  value === option.value && 'bg-blue-50 text-blue-600 font-medium'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
