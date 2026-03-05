/**
 * Push Logs Panel - Filterable table with pagination and detail dialog
 */

import { useState, useCallback } from 'react';
import { usePushLogs, type PushLog, type PushLogFilters } from '@/hooks/usePushLogs';
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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

const PAGE_SIZE = 50;

const PUSH_CODE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: '1', label: '1 - Authorization' },
  { value: '2', label: '2 - Deauthorization' },
  { value: '5', label: '5 - Updates' },
  { value: '12', label: '12 - Expiry' },
  { value: '28', label: '28 - Penalty' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'true', label: 'Đã xử lý' },
  { value: 'false', label: 'Chưa xử lý' },
];

const DATE_OPTIONS = [
  { value: '1h', label: '1 giờ' },
  { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

const PUSH_TYPE_COLORS: Record<number, string> = {
  1: 'bg-green-50 text-green-700',
  2: 'bg-red-50 text-red-700',
  5: 'bg-blue-50 text-blue-700',
  12: 'bg-orange-50 text-orange-700',
  28: 'bg-yellow-50 text-yellow-700',
};

const PUSH_TYPE_LABELS: Record<number, string> = {
  1: 'Authorization',
  2: 'Deauthorization',
  5: 'Updates',
  12: 'Expiry',
  28: 'Penalty',
};

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

function PushTypeBadge({ code }: { code: number }) {
  const color = PUSH_TYPE_COLORS[code] || 'bg-slate-50 text-slate-700';
  const label = PUSH_TYPE_LABELS[code] || `Code ${code}`;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ProcessedBadge({ processed }: { processed: boolean }) {
  if (processed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <CheckCircle className="w-3 h-3" /> OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

export function PushLogsPanel() {
  const [filters, setFilters] = useState<PushLogFilters>({
    page: 0,
    pageSize: PAGE_SIZE,
    dateRange: '7d',
  });
  const [searchInput, setSearchInput] = useState('');
  const [selectedLog, setSelectedLog] = useState<PushLog | null>(null);

  const { data, isLoading, refetch, isFetching } = usePushLogs(filters);
  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 0 }));
  }, [searchInput]);

  const updateFilter = (key: keyof PushLogFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
  };

  return (
    <div className="flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Filters */}
      <div className="flex-shrink-0 p-4 bg-white border-b space-y-3">
        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm push type, kết quả xử lý..."
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
          <Select
            value={filters.pushCode?.toString() || 'all'}
            onValueChange={(v) => updateFilter('pushCode', v === 'all' ? undefined : Number(v))}
          >
            <SelectTrigger className="w-[180px] h-8 text-sm cursor-pointer">
              <SelectValue placeholder="Push Code" />
            </SelectTrigger>
            <SelectContent>
              {PUSH_CODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.processed || 'all'} onValueChange={(v) => updateFilter('processed', v)}>
            <SelectTrigger className="w-[140px] h-8 text-sm cursor-pointer">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.dateRange || '7d'} onValueChange={(v) => updateFilter('dateRange', v)}>
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
            <p className="font-medium">Không có push logs</p>
            <p className="text-sm mt-1">Chưa nhận được push notification nào từ Shopee</p>
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
                    <PushTypeBadge code={log.push_code} />
                    <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <ProcessedBadge processed={log.processed} />
                    {log.shop_id && (
                      <span className="text-xs text-slate-500">Shop: {log.shop_id}</span>
                    )}
                  </div>
                  {log.process_result && (
                    <p className="text-xs text-slate-600 mt-1 truncate">{log.process_result}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 border-b sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Thời gian</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Push Type</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Shop ID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Trạng thái</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Kết quả</th>
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
                    <td className="px-4 py-2">
                      <PushTypeBadge code={log.push_code} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                      {log.shop_id || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <ProcessedBadge processed={log.processed} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 truncate max-w-[300px]">
                      {log.process_result || '-'}
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
              <PushTypeBadge code={selectedLog?.push_code || 0} />
              <span className="text-sm text-slate-600">{selectedLog?.push_type}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 mt-2">
              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem label="Thời gian" value={formatFullDate(selectedLog.created_at)} />
                <DetailItem label="Push Code" value={`${selectedLog.push_code} - ${PUSH_TYPE_LABELS[selectedLog.push_code] || 'Unknown'}`} />
                <DetailItem label="Shop ID" value={selectedLog.shop_id?.toString() || '-'} />
                <DetailItem label="Merchant ID" value={selectedLog.merchant_id?.toString() || '-'} />
                <DetailItem label="Partner ID" value={selectedLog.partner_id?.toString() || '-'} />
                <DetailItem label="Shopee Timestamp" value={selectedLog.shopee_timestamp ? new Date(selectedLog.shopee_timestamp * 1000).toLocaleString('vi-VN') : '-'} />
              </div>

              {/* Process result */}
              <div className="flex items-center gap-3 p-2 rounded-lg text-sm" style={{
                backgroundColor: selectedLog.processed ? 'rgb(240 253 244)' : 'rgb(254 252 232)',
              }}>
                <ProcessedBadge processed={selectedLog.processed} />
                {selectedLog.process_result && (
                  <span className="text-xs text-slate-600">{selectedLog.process_result}</span>
                )}
              </div>

              {/* Raw data */}
              {selectedLog.data && Object.keys(selectedLog.data).length > 0 && (
                <CollapsibleJson
                  label="Raw Push Data"
                  data={selectedLog.data}
                  defaultOpen={true}
                />
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

function CollapsibleJson({
  label,
  data,
  defaultOpen = false,
}: {
  label: string;
  data: Record<string, unknown>;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="text-xs font-medium text-slate-600">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
          title="Copy JSON"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      </button>
      {isOpen && (
        <pre className="text-xs p-3 overflow-auto max-h-[400px] bg-white font-mono leading-relaxed text-slate-700">
          {jsonString}
        </pre>
      )}
    </div>
  );
}
