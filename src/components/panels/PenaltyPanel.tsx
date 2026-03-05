/**
 * Penalty Panel - Display shop penalty push notifications (push_code = 28)
 * Shows violation types, penalty points, and action types
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Copy,
  Check,
  Plus,
  Minus,
  ArrowUpDown,
} from 'lucide-react';

const PAGE_SIZE = 50;

const DATE_OPTIONS = [
  { value: '1h', label: '1 giờ' },
  { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

const ACTION_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả hành động' },
  { value: '1', label: 'Cộng điểm phạt' },
  { value: '2', label: 'Trừ điểm phạt' },
  { value: '3', label: 'Cập nhật tier' },
];

// Extract penalty info from push data
function getPenaltyInfo(data: Record<string, unknown> | null) {
  if (!data) return null;

  const actionType = data.action_type as number | undefined;
  const pointsIssued = data.points_issued_data as Record<string, unknown> | undefined;
  const pointsRemoved = data.points_removed_data as Record<string, unknown> | undefined;
  const tierData = data.tier_data as Record<string, unknown> | undefined;

  return {
    actionType,
    violationType: (pointsIssued?.violation_type || pointsRemoved?.violation_type || '') as string,
    violationReason: (pointsIssued?.violation_reason || pointsRemoved?.violation_reason || '') as string,
    points: (pointsIssued?.points_issued || pointsRemoved?.points_removed || 0) as number,
    currentTier: (tierData?.current_tier || data.current_tier || '') as string,
    previousTier: (tierData?.previous_tier || data.previous_tier || '') as string,
  };
}

function ActionTypeBadge({ actionType }: { actionType: number | undefined }) {
  switch (actionType) {
    case 1:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
          <Plus className="w-3 h-3" /> Cộng điểm
        </span>
      );
    case 2:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
          <Minus className="w-3 h-3" /> Trừ điểm
        </span>
      );
    case 3:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
          <ArrowUpDown className="w-3 h-3" /> Tier
        </span>
      );
    default:
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-600">
          Không rõ
        </span>
      );
  }
}

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

export function PenaltyPanel() {
  const [filters, setFilters] = useState<PushLogFilters>({
    pushCode: 28,
    page: 0,
    pageSize: PAGE_SIZE,
    dateRange: '30d',
  });
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [selectedLog, setSelectedLog] = useState<PushLog | null>(null);

  const { data, isLoading, refetch, isFetching } = usePushLogs(filters);

  // Client-side filter by action_type since the hook doesn't support it
  const filteredLogs = (data?.logs || []).filter((log) => {
    if (actionTypeFilter === 'all') return true;
    const penalty = getPenaltyInfo(log.data);
    return penalty?.actionType?.toString() === actionTypeFilter;
  });
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 0 }));
  }, [searchInput]);

  const updateFilter = (key: keyof PushLogFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
  };

  const selectedPenalty = selectedLog ? getPenaltyInfo(selectedLog.data) : null;

  return (
    <div className="flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Filters */}
      <div className="flex-shrink-0 p-4 bg-white border-b space-y-3">
        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm loại vi phạm, lý do..."
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
          <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
            <SelectTrigger className="w-[180px] h-8 text-sm cursor-pointer">
              <SelectValue placeholder="Hành động" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.dateRange || '30d'} onValueChange={(v) => updateFilter('dateRange', v)}>
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
            {totalCount} vi phạm
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
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Không có vi phạm</p>
            <p className="text-sm mt-1">Chưa có thông báo vi phạm nào từ Shopee</p>
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const penalty = getPenaltyInfo(log.data);
                return (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <ActionTypeBadge actionType={penalty?.actionType} />
                      <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                    </div>
                    {penalty?.violationType && (
                      <p className="text-sm text-slate-700 font-medium">{penalty.violationType}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {penalty?.points ? (
                        <span className={`text-xs font-medium ${penalty.actionType === 1 ? 'text-red-600' : 'text-green-600'}`}>
                          {penalty.actionType === 1 ? '+' : '-'}{penalty.points} điểm
                        </span>
                      ) : null}
                      {log.shop_id && (
                        <span className="text-xs text-slate-500">Shop: {log.shop_id}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 border-b sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Thời gian</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Shop ID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Hành động</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Loại vi phạm</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Điểm phạt</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const penalty = getPenaltyInfo(log.data);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 font-mono whitespace-nowrap">
                        {log.shop_id || '-'}
                      </td>
                      <td className="px-4 py-2">
                        <ActionTypeBadge actionType={penalty?.actionType} />
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700 max-w-[200px] truncate">
                        {penalty?.violationType || '-'}
                      </td>
                      <td className="px-4 py-2">
                        {penalty?.points ? (
                          <span className={`text-xs font-semibold ${penalty.actionType === 1 ? 'text-red-600' : 'text-green-600'}`}>
                            {penalty.actionType === 1 ? '+' : '-'}{penalty.points}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600 max-w-[250px] truncate">
                        {penalty?.violationReason || '-'}
                      </td>
                    </tr>
                  );
                })}
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
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Chi tiết vi phạm
            </DialogTitle>
          </DialogHeader>

          {selectedLog && selectedPenalty && (
            <div className="space-y-4 mt-2">
              {/* Action type highlight */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <ActionTypeBadge actionType={selectedPenalty.actionType} />
                {selectedPenalty.points > 0 && (
                  <span className={`text-sm font-semibold ${selectedPenalty.actionType === 1 ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedPenalty.actionType === 1 ? '+' : '-'}{selectedPenalty.points} điểm phạt
                  </span>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem label="Thời gian" value={formatFullDate(selectedLog.created_at)} />
                <DetailItem label="Shop ID" value={selectedLog.shop_id?.toString() || '-'} />
                <DetailItem label="Merchant ID" value={selectedLog.merchant_id?.toString() || '-'} />
                <DetailItem label="Partner ID" value={selectedLog.partner_id?.toString() || '-'} />
                {selectedPenalty.violationType && (
                  <DetailItem label="Loại vi phạm" value={selectedPenalty.violationType} />
                )}
                {selectedPenalty.violationReason && (
                  <DetailItem label="Lý do" value={selectedPenalty.violationReason} />
                )}
                {selectedPenalty.actionType === 3 && selectedPenalty.currentTier && (
                  <>
                    <DetailItem label="Tier trước" value={selectedPenalty.previousTier || '-'} />
                    <DetailItem label="Tier hiện tại" value={selectedPenalty.currentTier} />
                  </>
                )}
                {selectedLog.shopee_timestamp && (
                  <DetailItem
                    label="Shopee Timestamp"
                    value={new Date(selectedLog.shopee_timestamp * 1000).toLocaleString('vi-VN')}
                  />
                )}
              </div>

              {/* Raw data */}
              {selectedLog.data && Object.keys(selectedLog.data).length > 0 && (
                <CollapsibleJson label="Raw Push Data" data={selectedLog.data} />
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
