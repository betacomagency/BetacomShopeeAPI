/**
 * API Call Logs Panel - Filterable table with pagination and detail dialog
 * Theo dõi các lệnh gọi Shopee API từ hệ thống
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  useApiCallLogs,
  fetchApiCallLogDetail,
  type ApiCallLog,
  type ApiCallLogListItem,
  type ApiCallLogFilters,
} from '@/hooks/useApiCallLogs';
import { useApiCallStats } from '@/hooks/useApiCallStats';
import { useShopeeAuth } from '@/contexts/ShopeeAuthContext';
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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  Check,
  Activity,
  TrendingDown,
  Percent,
  Timer,
} from 'lucide-react';

const PAGE_SIZE = 50;

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'auth', label: 'Auth' },
  { value: 'product', label: 'Product' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'shop', label: 'Shop' },
  { value: 'order', label: 'Order' },
  { value: 'finance', label: 'Finance' },
  { value: 'review', label: 'Review' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'success', label: 'Thành công' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'timeout', label: 'Timeout' },
];

const EDGE_FUNCTION_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'shopee-token-refresh', label: 'Token Refresh' },
  { value: 'apishopee-flash-sale-scheduler', label: 'Flash Sale' },
  { value: 'apishopee-product', label: 'Product' },
  { value: 'shopee-shop', label: 'Shop' },
  { value: 'apishopee-proxy', label: 'API Proxy' },
  { value: 'apishopee-auth', label: 'Auth' },
];

const DATE_OPTIONS = [
  { value: '1h', label: '1 giờ' },
  { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  auth: 'bg-info/10 text-info',
  product: 'bg-info/10 text-info',
  flash_sale: 'bg-brand/10 text-brand',
  shop: 'bg-success/10 text-success',
  order: 'bg-info/10 text-info',
  finance: 'bg-success/10 text-success',
  review: 'bg-warning/10 text-warning',
};

export const STATUS_COLORS: Record<string, string> = {
  success: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  timeout: 'bg-warning/10 text-warning',
};

const TRIGGERED_BY_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'user', label: 'Người dùng' },
  { value: 'cron', label: 'Cron Job' },
  { value: 'scheduler', label: 'Scheduler' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'system', label: 'Hệ thống' },
];

const TRIGGERED_BY_COLORS: Record<string, string> = {
  user: 'bg-info/10 text-info',
  cron: 'bg-warning/10 text-warning',
  scheduler: 'bg-info/10 text-info',
  webhook: 'bg-info/10 text-info',
  system: 'bg-muted text-muted-foreground',
};

export function formatDate(dateString: string | null): string {
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

export function formatEndpoint(endpoint: string): string {
  // Show only the last 2 segments: e.g. /api/v2/product/get_item_list → product/get_item_list
  const parts = endpoint.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join('/');
  }
  return endpoint;
}

export function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || 'bg-muted text-foreground';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">-</span>;
  const color = STATUS_COLORS[status] || 'bg-muted text-foreground';
  const Icon = status === 'success' ? CheckCircle : status === 'failed' ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {status === 'success' ? 'OK' : status === 'failed' ? 'Failed' : 'Timeout'}
    </span>
  );
}

export function TriggeredByBadge({ triggeredBy }: { triggeredBy: string | null }) {
  const value = triggeredBy || 'system';
  const color = TRIGGERED_BY_COLORS[value] || 'bg-muted text-muted-foreground';
  const label = TRIGGERED_BY_OPTIONS.find(o => o.value === value)?.label || value;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium break-all">{value}</p>
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
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-accent transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-accent transition-colors cursor-pointer"
          title="Copy JSON"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </button>
      {isOpen && (
        <pre className="text-xs p-3 overflow-auto max-h-[400px] bg-card font-mono leading-relaxed text-foreground">
          {jsonString}
        </pre>
      )}
    </div>
  );
}

interface PartnerApp {
  partner_id: number;
  partner_name: string;
  app_category: string;
}

export function ApiCallLogsPanel() {
  const { shops } = useShopeeAuth();
  const [filters, setFilters] = useState<ApiCallLogFilters>({
    page: 0,
    pageSize: PAGE_SIZE,
    dateRange: '7d',
  });
  const [searchInput, setSearchInput] = useState('');
  const [selectedLog, setSelectedLog] = useState<ApiCallLog | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);

  useEffect(() => {
    supabase
      .from('apishopee_partner_apps')
      .select('partner_id, partner_name, app_category')
      .then(({ data }) => {
        if (data) setPartnerApps(data as PartnerApp[]);
      });
  }, []);

  const { data, isLoading, refetch, isFetching } = useApiCallLogs(filters);

  // Daily stats for summary cards
  const { data: statsData, isLoading: statsLoading } = useApiCallStats({
    shopId: filters.shopId,
    partnerId: filters.partnerId,
    dateRange: filters.dateRange,
  });
  const summary = statsData?.summary;

  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Shop name lookup map
  const shopNameMap = useMemo(() => {
    const map = new Map<number, string>();
    shops.forEach((s) => {
      if (s.shop_name) map.set(s.shop_id, s.shop_name);
    });
    return map;
  }, [shops]);

  const shopOptions = useMemo(() => {
    return shops
      .filter((s) => s.shop_name)
      .sort((a, b) => (a.shop_name || '').localeCompare(b.shop_name || '', 'vi'))
      .map((s) => ({ value: s.shop_id.toString(), label: s.shop_name || s.shop_id.toString() }));
  }, [shops]);

  // Unique user emails from visible logs (for filter)
  const userEmailOptions = useMemo(() => {
    const emails = [...new Set(logs.map((l) => l.user_email).filter((e): e is string => !!e))];
    return emails.sort();
  }, [logs]);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 0 }));
  }, [searchInput]);

  const updateFilter = (key: keyof ApiCallLogFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
  };

  const handleRowClick = async (log: ApiCallLogListItem) => {
    setLoadingDetail(true);
    setSelectedLog(null);
    const detail = await fetchApiCallLogDetail(log.id);
    setSelectedLog(detail);
    setLoadingDetail(false);
  };

  const getShopName = (shopId: number | null) => {
    if (!shopId) return '-';
    return shopNameMap.get(shopId) || shopId.toString();
  };

  const getPartnerName = (partnerId: number | null) => {
    if (!partnerId) return null;
    const app = partnerApps.find(p => p.partner_id === partnerId);
    return app ? app.partner_name : partnerId.toString();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Cards + Chart */}
      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-info" />
              <span className="text-xs text-muted-foreground">Tổng Calls</span>
            </div>
            {statsLoading ? (
              <div className="h-7 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-foreground tabular-nums">
                {(summary?.total || 0).toLocaleString('vi-VN')}
              </p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Thất bại</span>
            </div>
            {statsLoading ? (
              <div className="h-7 w-16 bg-destructive/10 rounded animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-destructive tabular-nums">
                {(summary?.failed || 0).toLocaleString('vi-VN')}
                {summary && summary.total > 0 && (
                  <span className="text-xs font-normal text-destructive/60 ml-1">
                    ({((summary.failed / summary.total) * 100).toFixed(1)}%)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-success/10 border border-success">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Tỷ lệ thành công</span>
            </div>
            {statsLoading ? (
              <div className="h-7 w-16 bg-success/10 rounded animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-success tabular-nums">
                {(summary?.successRate || 0).toFixed(1)}%
              </p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">TB Duration</span>
            </div>
            {statsLoading ? (
              <div className="h-7 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-xl font-bold text-foreground tabular-nums">
                {summary?.avgDuration || 0}<span className="text-sm font-normal text-muted-foreground ml-0.5">ms</span>
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Logs Table */}
      <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      {/* Filters */}
      <div className="flex-shrink-0 p-4 bg-card border-b space-y-3">
        {/* Search + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm endpoint, lỗi..."
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
        <div className="flex flex-wrap items-end gap-2">
          {/* Shop filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Shop</label>
            <Select
              value={filters.shopId?.toString() || 'all'}
              onValueChange={(v) => updateFilter('shopId', v === 'all' ? undefined : Number(v))}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Shop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {shopOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Partner filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Partner</label>
            <Select
              value={filters.partnerId?.toString() || 'all'}
              onValueChange={(v) => updateFilter('partnerId', v === 'all' ? undefined : Number(v))}
            >
              <SelectTrigger className="w-[150px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Partner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {partnerApps.map((p) => (
                  <SelectItem key={p.partner_id} value={p.partner_id.toString()} className="cursor-pointer">
                    {p.partner_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Danh mục</label>
            <Select
              value={filters.category || 'all'}
              onValueChange={(v) => updateFilter('category', v)}
            >
              <SelectTrigger className="w-[130px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Danh mục" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Trạng thái</label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => updateFilter('status', v)}
            >
              <SelectTrigger className="w-[130px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Edge function filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Function</label>
            <Select
              value={filters.edgeFunction || 'all'}
              onValueChange={(v) => updateFilter('edgeFunction', v)}
            >
              <SelectTrigger className="w-[150px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Function" />
              </SelectTrigger>
              <SelectContent>
                {EDGE_FUNCTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User filter */}
          {userEmailOptions.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Người dùng</label>
              <Select
                value={filters.userEmail || 'all'}
                onValueChange={(v) => updateFilter('userEmail', v)}
              >
                <SelectTrigger className="w-[160px] h-8 text-sm cursor-pointer">
                  <SelectValue placeholder="Người dùng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {userEmailOptions.map((email) => (
                    <SelectItem key={email} value={email} className="cursor-pointer">
                      {email.split('@')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Triggered by filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nguồn</label>
            <Select
              value={filters.triggeredBy || 'all'}
              onValueChange={(v) => updateFilter('triggeredBy', v)}
            >
              <SelectTrigger className="w-[130px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Nguồn" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERED_BY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Thời gian</label>
            <Select value={filters.dateRange || '7d'} onValueChange={(v) => updateFilter('dateRange', v)}>
              <SelectTrigger className="w-[110px] h-8 text-sm cursor-pointer">
                <SelectValue placeholder="Thời gian" />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-muted-foreground ml-auto self-end pb-1">
            {totalCount.toLocaleString('vi-VN')} kết quả
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-muted" />
            <p className="font-medium">Không có API call logs</p>
            <p className="text-sm mt-1">Thử thay đổi bộ lọc để xem kết quả khác</p>
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleRowClick(log)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <CategoryBadge category={log.api_category} />
                      <StatusBadge status={log.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="text-xs text-foreground font-medium truncate">
                    {formatEndpoint(log.api_endpoint)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {getShopName(log.shop_id)}
                    </span>
                    {log.user_email ? (
                      <span className="text-xs text-muted-foreground">{log.user_email.split('@')[0]}</span>
                    ) : (
                      <TriggeredByBadge triggeredBy={log.triggered_by} />
                    )}
                    {log.duration_ms != null && (
                      <span className="text-xs text-muted-foreground">{log.duration_ms}ms</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-muted border-b sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Thời gian</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Shop</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Partner</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">API Endpoint</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Duration</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-accent transition-colors"
                  >
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap max-w-[120px] truncate">
                      {getShopName(log.shop_id)}
                    </td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {getPartnerName(log.partner_id) ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-info/10 text-info text-xs font-medium">
                          {getPartnerName(log.partner_id)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground truncate max-w-[250px] font-mono" title={log.api_endpoint}>
                      {formatEndpoint(log.api_endpoint)}
                    </td>
                    <td className="px-4 py-2">
                      <CategoryBadge category={log.api_category} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap max-w-[120px] truncate" title={log.user_email || ''}>
                      {log.user_email ? log.user_email.split('@')[0] : <TriggeredByBadge triggeredBy={log.triggered_by} />}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground text-right whitespace-nowrap tabular-nums">
                      {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => handleRowClick(log)}>
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
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
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-card border-t">
          <span className="text-xs text-muted-foreground">
            Trang {filters.page + 1} / {totalPages.toLocaleString('vi-VN')}
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

      </div>{/* end Logs Table */}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog || loadingDetail} onOpenChange={() => { setSelectedLog(null); setLoadingDetail(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingDetail && !selectedLog ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-3 text-sm text-muted-foreground">Đang tải chi tiết...</span>
            </div>
          ) : selectedLog ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base flex-wrap">
                  <StatusBadge status={selectedLog.status} />
                  <CategoryBadge category={selectedLog.api_category} />
                  <span className="text-sm text-foreground font-mono">
                    {formatEndpoint(selectedLog.api_endpoint)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Basic info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="Thời gian" value={formatFullDate(selectedLog.created_at)} />
                  <DetailItem label="Shop" value={getShopName(selectedLog.shop_id)} />
                  {selectedLog.partner_id && (
                    <DetailItem label="Partner" value={getPartnerName(selectedLog.partner_id) || selectedLog.partner_id.toString()} />
                  )}
                  <DetailItem label="API Endpoint" value={selectedLog.api_endpoint} />
                  <DetailItem label="HTTP Method" value={selectedLog.http_method || 'GET'} />
                  <DetailItem label="Edge Function" value={selectedLog.edge_function} />
                  <DetailItem label="HTTP Status" value={selectedLog.http_status_code?.toString() || '-'} />
                  <DetailItem label="Duration" value={selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : '-'} />
                  <DetailItem label="Người dùng" value={selectedLog.user_email || '-'} />
                  <DetailItem label="Nguồn" value={TRIGGERED_BY_OPTIONS.find(o => o.value === (selectedLog.triggered_by || 'system'))?.label || selectedLog.triggered_by || 'system'} />
                  <DetailItem label="Retry Count" value={selectedLog.retry_count?.toString() || '0'} />
                  {selectedLog.was_token_refreshed && (
                    <DetailItem label="Token Refreshed" value="Có" />
                  )}
                </div>

                {/* Error info */}
                {selectedLog.shopee_error && (
                  <div className="p-3 rounded-lg bg-destructive/10 space-y-1">
                    <p className="text-xs text-destructive font-medium">Shopee Error</p>
                    <p className="text-sm text-destructive font-mono">{selectedLog.shopee_error}</p>
                    {selectedLog.shopee_message && (
                      <p className="text-xs text-destructive">{selectedLog.shopee_message}</p>
                    )}
                  </div>
                )}

                {/* Collapsible JSON sections */}
                {selectedLog.request_params && Object.keys(selectedLog.request_params).length > 0 && (
                  <CollapsibleJson
                    label="Request Params"
                    data={selectedLog.request_params}
                    defaultOpen={false}
                  />
                )}
                {selectedLog.response_summary && Object.keys(selectedLog.response_summary).length > 0 && (
                  <CollapsibleJson
                    label="Response Summary"
                    data={selectedLog.response_summary}
                    defaultOpen={true}
                  />
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
