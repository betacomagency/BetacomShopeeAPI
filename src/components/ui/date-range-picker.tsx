/**
 * Date Range Picker - Chọn khoảng ngày với calendar popup
 * Style giống Shopee Open Platform
 */

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

function formatRange(range: DateRange | undefined): string {
  if (!range?.from) return 'Chọn ngày';
  const from = format(range.from, 'dd/MM/yyyy', { locale: vi });
  if (!range.to) return from;
  const to = format(range.to, 'dd/MM/yyyy', { locale: vi });
  return `${from} – ${to}`;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-3 text-sm font-normal gap-2 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-700">{formatRange(value)}</span>
      </Button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 bg-white rounded-lg border border-slate-200 shadow-lg">
          <Calendar
            mode="range"
            selected={value}
            onSelect={(range) => {
              onChange(range);
              // Close when both dates selected
              if (range?.from && range?.to) {
                setTimeout(() => setOpen(false), 150);
              }
            }}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
            defaultMonth={value?.from || new Date()}
          />
        </div>
      )}
    </div>
  );
}
