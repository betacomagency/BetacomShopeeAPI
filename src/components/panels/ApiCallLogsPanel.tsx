/**
 * API Call Logs Panel - Filterable table with pagination and detail dialog
 */

import { useState, useCallback, useEffect } from 'react';
import { useApiLogs, type ApiCallLog, type ApiLogFilters } from '@/hooks/useApiLogs';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Repeat,
  Shield,
} from 'lucide-react';

const PAGE_SIZE = 50;

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'shop', label: 'Shop' },
  { value: 'product', label: 'Product' },
  { value: 'ads', label: 'Ads' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'review', label: 'Review' },
  { value: 'auth', label: 'Auth' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'timeout', label: 'Timeout' },
];

const DATE_OPTIONS = [
  { value: '1h', label: '1 giờ' },
  { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatFullDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (!ms && ms !== 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <CheckCircle className="w-3 h-3" /> OK
      </span>
    );
  }
  if (status === 'timeout') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
        <Clock className="w-3 h-3" /> Timeout
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    shop: 'bg-blue-50 text-blue-700',
    product: 'bg-green-50 text-green-700',
    ads: 'bg-purple-50 text-purple-700',
    flash_sale: 'bg-orange-50 text-orange-700',
    review: 'bg-yellow-50 text-yellow-700',
    auth: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[category] || 'bg-slate-50 text-slate-700'}`}>
      {category}
    </span>
  );
}

export function ApiCallLogsPanel() {
  const [filters, setFilters] = useState<ApiLogFilters>({
    page: 0,
    pageSize: PAGE_SIZE,
    dateRange: '24h',
  });
  const [searchInput, setSearchInput] = useState('');
  const [selectedLog, setSelectedLog] = useState<ApiCallLog | null>(null);
  const [shops, setShops] = useState<Array<{ shop_id: number; shop_name: string | null }>>([]);

  // Fetch shop list for filter
  useEffect(() => {
    supabase
      .from('apishopee_shops')
      .select('shop_id, shop_name')
      .order('shop_name')
      .then(({ data }) => {
        if (data) setShops(data);
      });
  }, []);

  const { data, isLoading, refetch, isFetching } = useApiLogs(filters);
  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 0 }));
  }, [searchInput]);

  const updateFilter = (key: keyof ApiLogFilters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex-shrink-0 p-4 bg-white border-b space-y-3">
        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm endpoint, error, edge function..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch} className="h-9 cursor-pointer">
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {shops.length > 0 && (
            <Select
              value={filters.shopId?.toString() || 'all'}
              onValueChange={(v) => updateFilter('shopId', v === 'all' ? undefined as unknown as number : Number(v))}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Shop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="cursor-pointer">Tất cả shop</SelectItem>
                {shops.map((shop) => (
                  <SelectItem key={shop.shop_id} value={shop.shop_id.toString()} className="cursor-pointer">
                    {shop.shop_name || `Shop ${shop.shop_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filters.apiCategory || 'all'} onValueChange={(v) => updateFilter('apiCategory', v)}>
            <SelectTrigger className="w-[130px] h-8 text-sm cursor-pointer">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status || 'all'} onValueChange={(v) => updateFilter('status', v)}>
            <SelectTrigger className="w-[120px] h-8 text-sm cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.dateRange || '24h'} onValueChange={(v) => updateFilter('dateRange', v)}>
            <SelectTrigger className="w-[110px] h-8 text-sm cursor-pointer">
              <SelectValue placeholder="Thời gian" />
            </SelectTrigger>
            <SelectContent>
              {DATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-slate-400 ml-auto">
            {totalCount} kết quả
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Không có logs</p>
            <p className="text-sm mt-1">Thử thay đổi bộ lọc hoặc chờ API calls được ghi log</p>
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <StatusBadge status={log.status} />
                    <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="text-xs font-mono text-slate-700 truncate">{log.api_endpoint}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CategoryBadge category={log.api_category} />
                    <span className="text-xs text-slate-400">{formatDuration(log.duration_ms)}</span>
                    {log.shopee_error && (
                      <span className="text-xs text-red-500 truncate">{log.shopee_error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 border-b sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Thời gian</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Shop</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Endpoint</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Category</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Duration</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Error</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-slate-500 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                      {log.shop_id || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-bold px-1 rounded ${
                          log.http_method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {log.http_method}
                        </span>
                        <span className="text-xs font-mono text-slate-700 truncate max-w-[250px]">
                          {log.api_endpoint}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <CategoryBadge category={log.api_category} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {formatDuration(log.duration_ms)}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-500 truncate max-w-[150px]">
                      {log.shopee_error || '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-t">
          <span className="text-xs text-slate-400">
            Trang {filters.page + 1} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page === 0}
              onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(0, prev.page - 1) }))}
              className="h-7 w-7 p-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages - 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="h-7 w-7 p-0 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <StatusBadge status={selectedLog?.status || ''} />
              <span className="font-mono text-sm truncate">{selectedLog?.api_endpoint}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 mt-2">
              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem label="Thời gian" value={formatFullDate(selectedLog.created_at)} />
                <DetailItem label="Shop ID" value={selectedLog.shop_id?.toString() || '-'} />
                <DetailItem label="Edge Function" value={selectedLog.edge_function} />
                <DetailItem label="HTTP Method" value={selectedLog.http_method} />
                <DetailItem label="Category" value={selectedLog.api_category} />
                <DetailItem label="Duration" value={formatDuration(selectedLog.duration_ms)} />
              </div>

              {/* Retry & Token info */}
              {(selectedLog.retry_count > 0 || selectedLog.was_token_refreshed) && (
                <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg text-sm">
                  {selectedLog.retry_count > 0 && (
                    <span className="flex items-center gap-1 text-amber-700">
                      <Repeat className="w-3.5 h-3.5" /> Retry: {selectedLog.retry_count}
                    </span>
                  )}
                  {selectedLog.was_token_refreshed && (
                    <span className="flex items-center gap-1 text-amber-700">
                      <Shield className="w-3.5 h-3.5" /> Token refreshed
                    </span>
                  )}
                </div>
              )}

              {/* Error details */}
              {selectedLog.shopee_error && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1">Shopee Error</p>
                  <p className="text-sm text-red-600 font-mono">{selectedLog.shopee_error}</p>
                  {selectedLog.shopee_message && (
                    <p className="text-xs text-red-500 mt-1">{selectedLog.shopee_message}</p>
                  )}
                </div>
              )}

              {/* Response summary */}
              {selectedLog.response_summary && Object.keys(selectedLog.response_summary).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Response Summary</p>
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.response_summary, null, 2)}
                  </pre>
                </div>
              )}

              {/* Request params */}
              {selectedLog.request_params && Object.keys(selectedLog.request_params).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Request Params</p>
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.request_params, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-700 font-medium">{value}</p>
    </div>
  );
}
