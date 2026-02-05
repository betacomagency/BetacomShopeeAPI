/**
 * Value Analysis Tab - Theo giá trị đơn hàng
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AnalyticsDateRangePicker, type AnalyticsDateRange } from '@/components/ui/date-range-picker';

import { COLORS } from '../constants';
import { formatNumber } from '../helpers';
import type { ValueRange, QuantityRange, Totals } from '../types';

interface ValueAnalysisTabProps {
  dateRange: AnalyticsDateRange;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  loading: boolean;
  valueRanges: ValueRange[];
  quantityRanges: QuantityRange[];
  totals: Totals;
}

export function ValueAnalysisTab({
  dateRange,
  onDateRangeChange,
  loading,
  valueRanges,
  quantityRanges,
  totals,
}: ValueAnalysisTabProps) {
  return (
    <>
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <AnalyticsDateRangePicker value={dateRange} onChange={onDateRangeChange} />
            <div className="flex-1" />
            <div className="text-sm text-slate-500">
              Tổng đơn hoàn thành: <span className="font-medium text-blue-600">{formatNumber(totals.completed)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Price Range */}
        <Card>
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-base font-medium">Giá trị đơn hàng theo khoảng giá</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-[180px] flex items-center justify-center">
                <Spinner className="w-8 h-8" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data={valueRanges.filter((r) => r.count > 0) as any}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="count"
                    nameKey="range"
                  >
                    {valueRanges.filter((r) => r.count > 0).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _name: any, props: any) => {
                      const payload = props.payload as { range?: string; percent?: number } | undefined;
                      return [
                        `${formatNumber(Number(value))} đơn (${payload?.percent?.toFixed(2) || 0}%)`,
                        payload?.range || '',
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {valueRanges
                .filter((r) => r.count > 0)
                .map((range, index) => (
                  <div key={range.range} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-slate-600">{range.range}</span>
                  </div>
                ))}
            </div>
            {/* Detailed Table with Bar Charts */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-2 text-center font-medium text-slate-600 w-8">#</th>
                    <th className="px-2 py-2 text-right font-medium text-slate-600">Khoảng giá</th>
                    <th className="px-2 py-2 text-right font-medium text-slate-600">Tổng hóa đơn</th>
                    <th className="px-2 py-2 text-right font-medium text-slate-600 w-20">Tỷ lệ(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Total row */}
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right font-medium">Tổng</td>
                    <td className="px-2 py-2 text-right text-blue-600 font-medium">
                      {formatNumber(valueRanges.reduce((s, r) => s + r.count, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-medium">100%</td>
                  </tr>
                  {/* Data rows - only show rows with count > 0 */}
                  {valueRanges
                    .filter((r) => r.count > 0)
                    .map((range, index) => {
                      const maxCount = Math.max(...valueRanges.map((r) => r.count));
                      const barWidth = maxCount > 0 ? (range.count / maxCount) * 100 : 0;
                      return (
                        <tr key={range.range} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1.5 text-center text-blue-600">{index + 1}</td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span>{range.range}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[80px]">
                                <div
                                  className="h-4 bg-blue-200 rounded-sm"
                                  style={{ width: `${barWidth}%`, marginLeft: 'auto' }}
                                />
                              </div>
                              <span className="w-14 text-right tabular-nums">{formatNumber(range.count)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{range.percent.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* By Quantity */}
        <Card>
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-base font-medium">Theo số lượng sản phẩm</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-[180px] flex items-center justify-center">
                <Spinner className="w-8 h-8" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data={quantityRanges.filter((r) => r.count > 0) as any}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="count"
                    nameKey="range"
                  >
                    {quantityRanges.filter((r) => r.count > 0).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, _name: any, props: any) => {
                      const payload = props.payload as { range?: string; percent?: number } | undefined;
                      return [
                        `${formatNumber(Number(value))} đơn (${payload?.percent?.toFixed(2) || 0}%)`,
                        payload?.range || '',
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {quantityRanges
                .filter((r) => r.count > 0)
                .map((range, index) => (
                  <div key={range.range} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-slate-600">{range.range}</span>
                  </div>
                ))}
            </div>
            {/* Detailed Table with Bar Charts */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-2 text-center font-medium text-slate-600 w-8">#</th>
                    <th className="px-2 py-2 text-right font-medium text-slate-600">Khoảng SL sản phẩm</th>
                    <th className="px-2 py-2 text-right font-medium text-slate-600">Tổng hóa đơn</th>
                    <th className="px-2 py-2 text-right font-medium text-slate-600 w-20">Tỷ lệ(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Total row */}
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right font-medium">Tổng</td>
                    <td className="px-2 py-2 text-right text-blue-600 font-medium">
                      {formatNumber(quantityRanges.reduce((s, r) => s + r.count, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-medium">100%</td>
                  </tr>
                  {/* Data rows - only show rows with count > 0 */}
                  {quantityRanges
                    .filter((r) => r.count > 0)
                    .map((range, index) => {
                      const maxCount = Math.max(...quantityRanges.map((r) => r.count));
                      const barWidth = maxCount > 0 ? (range.count / maxCount) * 100 : 0;
                      return (
                        <tr key={range.range} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-1.5 text-center text-blue-600">{index + 1}</td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div
                                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span>{range.range}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 max-w-[80px]">
                                <div
                                  className="h-4 bg-blue-200 rounded-sm"
                                  style={{ width: `${barWidth}%`, marginLeft: 'auto' }}
                                />
                              </div>
                              <span className="w-14 text-right tabular-nums">{formatNumber(range.count)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{range.percent.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
