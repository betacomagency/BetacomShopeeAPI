/**
 * Custom tooltip for charts in Analytics Orders pages
 */

import type { CustomTooltipProps, TooltipPayloadEntry } from '../types';
import { formatNumber } from '../helpers';

export function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const dataPayload = payload[0]?.payload;
  const originalDate = dataPayload?.date;

  let formattedDate = 'N/A';
  if (originalDate) {
    const date = new Date(originalDate + 'T00:00:00');
    formattedDate = date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[200px]">
      <p className="text-sm font-medium text-slate-700 mb-2">{formattedDate}</p>
      <div className="space-y-1.5">
        {payload.map((entry: TooltipPayloadEntry, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-slate-600">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-slate-800">
              {entry.name === 'Doanh thu'
                ? formatNumber(Number(entry.value || 0)) + 'đ'
                : formatNumber(Number(entry.value || 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
