/**
 * API Registry Detail Page - Lịch sử gọi API cho 1 endpoint cụ thể
 * Có bộ lọc: shop, status, user, nguồn, thời gian + pagination
 */

import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  useApiCallLogs,
  fetchApiCallLogDetail,
  type ApiCallLog,
  type ApiCallLogListItem,
} from '@/hooks/useApiCallLogs';
import { useShopeeAuth } from '@/contexts/ShopeeAuthContext';
import {
  CategoryBadge,
  StatusBadge,
  TriggeredByBadge,
  formatEndpoint,
  formatDate,
} from '@/components/panels/ApiCallLogsPanel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle,
  Timer,
  X,
} from 'lucide-react';

const PAGE_SIZE = 30;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'success', label: 'Thành công' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'timeout', label: 'Timeout' },
];

const TRIGGERED_BY_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'user', label: 'Người dùng' },
  { value: 'cron', label: 'Cron Job' },
  { value: 'scheduler', label: 'Scheduler' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'system', label: 'Hệ thống' },
];

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-700 font-medium break-all">{value}</p>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const color = method === 'POST'
    ? 'bg-blue-50 text-blue-700'
    : 'bg-emerald-50 text-emerald-700';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${color}`}>
      {method || 'GET'}
    </span>
  );
}

export default function ApiRegistryDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { shops } = useShopeeAuth();

  const endpoint = searchParams.get('endpoint') || '';
  const method = searchParams.get('method') || 'GET';
  const category = searchParams.get('category') || '';
  const edgeFunction = searchParams.get('function') || '';
  const totalCalls = Number(searchParams.get('calls') || 0);
  const successRate = Number(searchParams.get('rate') || 0);
  const failedCount = Number(searchParams.get('failed') || 0);
  const avgDuration = Number(searchParams.get('avg_ms') || 0);

  // Filters
  const today = new Date();
  const [page, setPage] = useState(0);
  const [shopId, setShopId] = useState<string>('all');
  const [status, setStatus] = useState('all');
  const [triggeredBy, setTriggeredBy] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: today,
    to: today,
  });

  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<ApiCallLog | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const shopNameMap = useMemo(() => {
    const map = new Map<number, string>();
    shops.forEach((s) => {
      if (s.shop_name) map.set(s.shop_id, s.shop_name);
    });
    return map;
  }, [shops]);

  const { data, isLoading, isFetching, refetch } = useApiCallLogs({
    search: endpoint,
    shopId: shopId !== 'all' ? Number(shopId) : undefined,
    status: status !== 'all' ? status : undefined,
    triggeredBy: triggeredBy !== 'all' ? triggeredBy : undefined,
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    page,
    pageSize: PAGE_SIZE,
  });

  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleViewDetail = async (log: ApiCallLogListItem) => {
    setLoadingDetail(true);
    setSelectedLog(null);
    const detail = await fetchApiCallLogDetail(log.id);
    setSelectedLog(detail);
    setLoadingDetail(false);
  };

  const getShopName = (sid: number | null) => {
    if (!sid) return '-';
    return shopNameMap.get(sid) || sid.toString();
  };

  const resetFilters = () => {
    setPage(0);
    setShopId('all');
    setStatus('all');
    setTriggeredBy('all');
    setDateRange({ from: today, to: today });
  };

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  if (!endpoint) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Không tìm thấy endpoint</p>
        <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => navigate('/admin/api-registry')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 text-slate-500 hover:text-slate-700 cursor-pointer -ml-2"
          onClick={() => navigate('/admin/api-registry')}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> API Registry
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={method} />
          <CategoryBadge category={category} />
          <h1 className="text-base font-mono text-slate-800">{formatEndpoint(endpoint)}</h1>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">{endpoint}</p>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            <strong className="text-slate-700">{totalCalls.toLocaleString('vi-VN')}</strong> calls
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <strong className="text-emerald-600">{successRate}%</strong> thành công
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <X className="w-3.5 h-3.5" />
              <strong>{failedCount}</strong> lỗi
            </span>
          )}
          <span className="flex items-center gap-1">
            <Timer className="w-3.5 h-3.5 text-amber-500" />
            TB <strong className="text-slate-700">{avgDuration}ms</strong>
          </span>
          {edgeFunction && (
            <span className="text-slate-400">
              Edge: <strong className="text-slate-600">{edgeFunction}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b">
          <div className="flex flex-wrap items-end gap-2">
            {shops.length > 1 && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Shop</label>
                <Select value={shopId} onValueChange={handleFilterChange(setShopId)}>
                  <SelectTrigger className="w-[160px] h-8 text-sm cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="cursor-pointer">Tất cả</SelectItem>
                    {shops.map((s) => (
                      <SelectItem key={s.shop_id} value={s.shop_id.toString()} className="cursor-pointer">
                        {s.shop_name || s.shop_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Trạng thái</label>
              <Select value={status} onValueChange={handleFilterChange(setStatus)}>
                <SelectTrigger className="w-[120px] h-8 text-sm cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="cursor-pointer">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Nguồn</label>
              <Select value={triggeredBy} onValueChange={handleFilterChange(setTriggeredBy)}>
                <SelectTrigger className="w-[130px] h-8 text-sm cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERED_BY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="cursor-pointer">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ngày</label>
              <DateRangePicker
                value={dateRange}
                onChange={(v) => { setDateRange(v); setPage(0); }}
              />
            </div>

            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>

            <span className="text-xs text-slate-400 ml-auto self-end pb-1">
              {totalCount.toLocaleString('vi-VN')} kết quả
            </span>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-9 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Không có logs phù hợp</p>
            <Button variant="link" size="sm" className="mt-1 cursor-pointer" onClick={resetFilters}>
              Reset bộ lọc
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-center px-2 py-2 text-[11px] font-medium text-slate-500 w-12">STT</th>
                    <th className="text-left px-4 py-2 text-[11px] font-medium text-slate-500">Thời gian</th>
                    <th className="text-left px-4 py-2 text-[11px] font-medium text-slate-500">Shop</th>
                    <th className="text-left px-4 py-2 text-[11px] font-medium text-slate-500">Status</th>
                    <th className="text-left px-4 py-2 text-[11px] font-medium text-slate-500">Shopee Error</th>
                    <th className="text-left px-4 py-2 text-[11px] font-medium text-slate-500">User / Nguồn</th>
                    <th className="text-right px-4 py-2 text-[11px] font-medium text-slate-500">Duration</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log, index) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-2 py-2 text-xs text-slate-400 text-center tabular-nums">{page * PAGE_SIZE + index + 1}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-2 text-xs text-slate-600 max-w-[160px] truncate">{getShopName(log.shop_id)}</td>
                      <td className="px-4 py-2"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-2 text-xs text-red-500 max-w-[180px] truncate" title={log.shopee_error || ''}>
                        {log.shopee_error || '-'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {log.user_email ? log.user_email.split('@')[0] : <TriggeredByBadge triggeredBy={log.triggered_by} />}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 text-right tabular-nums">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 cursor-pointer" onClick={() => handleViewDetail(log)}>
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map((log, index) => (
                <div key={log.id} className="p-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">
                      <span className="text-slate-400 tabular-nums mr-1.5">#{page * PAGE_SIZE + index + 1}</span>
                      {formatDate(log.created_at)}
                    </span>
                    <StatusBadge status={log.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600 space-y-0.5 min-w-0">
                      <p className="truncate">{getShopName(log.shop_id)}</p>
                      <p className="text-slate-400">
                        {log.user_email ? log.user_email.split('@')[0] : log.triggered_by || '-'}
                        {log.duration_ms != null && <span className="ml-2 tabular-nums">{log.duration_ms}ms</span>}
                      </p>
                      {log.shopee_error && (
                        <p className="text-red-500 truncate">{log.shopee_error}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer flex-shrink-0" onClick={() => handleViewDetail(log)}>
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  Trang {page + 1}/{totalPages} · {totalCount.toLocaleString('vi-VN')} calls
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 px-2 cursor-pointer">
                    <ChevronLeft className="w-3 h-3 mr-1" /> Trước
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 px-2 cursor-pointer">
                    Sau <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog || loadingDetail} onOpenChange={() => { setSelectedLog(null); setLoadingDetail(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingDetail && !selectedLog ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-3 text-sm text-slate-500">Đang tải chi tiết...</span>
            </div>
          ) : selectedLog ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base flex-wrap">
                  <StatusBadge status={selectedLog.status} />
                  <CategoryBadge category={selectedLog.api_category} />
                  <span className="text-sm text-slate-600 font-mono">{formatEndpoint(selectedLog.api_endpoint)}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="Thời gian" value={selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString('vi-VN') : '-'} />
                  <DetailItem label="API Endpoint" value={selectedLog.api_endpoint} />
                  <DetailItem label="HTTP Method" value={selectedLog.http_method || 'GET'} />
                  <DetailItem label="Edge Function" value={selectedLog.edge_function} />
                  <DetailItem label="HTTP Status" value={selectedLog.http_status_code?.toString() || '-'} />
                  <DetailItem label="Duration" value={selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : '-'} />
                </div>
                {selectedLog.shopee_error && (
                  <div className="p-3 rounded-lg bg-red-50 space-y-1">
                    <p className="text-xs text-red-500 font-medium">Shopee Error</p>
                    <p className="text-sm text-red-700 font-mono">{selectedLog.shopee_error}</p>
                    {selectedLog.shopee_message && <p className="text-xs text-red-600">{selectedLog.shopee_message}</p>}
                  </div>
                )}
                {selectedLog.response_summary && Object.keys(selectedLog.response_summary).length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50">
                      <span className="text-xs font-medium text-slate-600">Response Summary</span>
                    </div>
                    <pre className="text-xs p-3 overflow-auto max-h-[300px] bg-white font-mono leading-relaxed text-slate-700">
                      {JSON.stringify(selectedLog.response_summary, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
