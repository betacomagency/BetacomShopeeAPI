/**
 * Cancel Reasons Tab - Lý do khách hủy
 */

import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AnalyticsDateRangePicker, type AnalyticsDateRange } from '@/components/ui/date-range-picker';

import { formatNumber } from '../helpers';
import type { CancelReason, Totals } from '../types';

interface CancelReasonsTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
  cancelReasons: CancelReason[];
  totals: Totals;
}

export function CancelReasonsTab({
  dateRange,
  onDateRangeChange,
  loading,
  cancelReasons,
  totals,
}: CancelReasonsTabProps) {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AnalyticsDateRangePicker value={dateRange} onChange={onDateRangeChange} />
            <div className="flex-1" />
            <div className="text-sm text-slate-500">
              Tổng đơn hủy: <span className="font-medium text-red-600">{formatNumber(totals.cancelled)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Spinner className="w-8 h-8" />
            </div>
          ) : cancelReasons.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400">Chưa có dữ liệu</div>
          ) : (
            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-600">#</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Lý do</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600">Hệ thống hủy</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600">Đã hoàn</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600">Tổng</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600">%</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelReasons.map((reason, index) => (
                    <tr key={reason.reason} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2 text-slate-700">{reason.reason}</td>
                      <td className="px-3 py-2 text-center">
                        {reason.systemCount > 0 ? formatNumber(reason.systemCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {reason.returnedCount > 0 ? formatNumber(reason.returnedCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-red-600 font-medium">{formatNumber(reason.totalCount)}</td>
                      <td className="px-3 py-2 text-center">{reason.totalPercent.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
