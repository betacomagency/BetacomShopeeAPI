/**
 * Status Analysis Tab - Theo trạng thái
 */

import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AnalyticsDateRangePicker, type AnalyticsDateRange } from '@/components/ui/date-range-picker';

import { formatNumber, formatDate } from '../helpers';
import type { DailyStatusStats, Totals } from '../types';

interface StatusAnalysisTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
  dailyStatusStats: DailyStatusStats[];
  totals: Totals;
}

export function StatusAnalysisTab({
  dateRange,
  onDateRangeChange,
  loading,
  dailyStatusStats,
  totals,
}: StatusAnalysisTabProps) {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AnalyticsDateRangePicker value={dateRange} onChange={onDateRangeChange} />
            <div className="flex-1" />
            <div className="text-sm text-slate-500">
              Tổng đơn: <span className="font-medium text-blue-600">{formatNumber(totals.created)}</span>
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
          ) : dailyStatusStats.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-slate-400">Chưa có dữ liệu</div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-280px)] border border-slate-200 rounded-lg">
              <table className="w-full text-sm border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-600">Ngày</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600">Xác nhận</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600">Đóng gói</th>
                    <th className="px-3 py-2 text-center font-medium text-yellow-600">Đang chuyển</th>
                    <th className="px-3 py-2 text-center font-medium text-green-600">Thành công</th>
                    <th className="px-3 py-2 text-center font-medium text-red-600">Hủy</th>
                    <th className="px-3 py-2 text-center font-medium text-orange-600">Hoàn</th>
                    <th className="px-3 py-2 text-center font-medium text-blue-600">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStatusStats.map((day) => (
                    <tr key={day.date} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">{formatDate(day.date)}</td>
                      <td className="px-3 py-2 text-center">
                        {day.confirmedCount > 0 ? formatNumber(day.confirmedCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {day.packagingCount > 0 ? formatNumber(day.packagingCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-yellow-600">
                        {day.shippingCount > 0 ? formatNumber(day.shippingCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-green-600">
                        {day.completedCount > 0 ? formatNumber(day.completedCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-red-600">
                        {day.cancelledCount > 0 ? formatNumber(day.cancelledCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-orange-600">
                        {day.returnsCount > 0 ? formatNumber(day.returnsCount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center text-blue-600">{formatNumber(day.totalCount)}</td>
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
