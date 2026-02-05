/**
 * ProductHistoryPanel - UI component hiển thị lịch sử biến đổi sản phẩm
 * Đọc dữ liệu từ bảng apishopee_product_history_logs
 * Hỗ trợ filter theo loại thay đổi, mức độ nghiêm trọng, và tìm kiếm
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  History,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  Ban,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Tag,
  Box,
  FileText,
  Trash2,
  Plus,
  Bell,
  BellOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Types
type ChangeType = 'price_change' | 'stock_change' | 'status_change' | 'content_change' | 'violation' | 'product_created' | 'product_deleted' | 'model_change';
type Severity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
type LogSource = 'webhook' | 'api_sync' | 'manual_check';

interface HistoryLog {
  id: string;
  shop_id: number;
  user_id: string;
  item_id: number;
  item_name: string | null;
  model_id: number | null;
  model_name: string | null;
  change_type: ChangeType;
  severity: Severity;
  source: LogSource;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  change_summary: string | null;
  change_details: Record<string, unknown> | null;
  violation_type: string | null;
  violation_reason: string | null;
  violation_suggestion: string | null;
  is_anomaly: boolean;
  anomaly_reason: string | null;
  detected_at: string;
  shopee_timestamp: number | null;
  is_read: boolean;
  read_at: string | null;
}

interface HistoryStats {
  total_count: number;
  unread_count: number;
  warning_count: number;
  high_severity_count: number;
  anomaly_count: number;
  today_count: number;
  price_changes: number;
  stock_changes: number;
  violations: number;
}

interface ProductHistoryPanelProps {
  shopId: number;
  userId: string;
}

// Filter tabs
const FILTER_TABS = [
  { key: 'ALL', label: 'Tất cả', icon: History },
  { key: 'price_change', label: 'Sửa giá', icon: Tag },
  { key: 'stock_change', label: 'Sửa kho', icon: Box },
  { key: 'violation', label: 'Vi phạm', icon: Ban },
  { key: 'status_change', label: 'Trạng thái', icon: FileText },
];

// Severity config
const SEVERITY_CONFIG: Record<Severity, { label: string; className: string; icon: typeof AlertTriangle }> = {
  INFO: { label: 'Thông tin', className: 'bg-blue-100 text-blue-700', icon: History },
  WARNING: { label: 'Cảnh báo', className: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  HIGH: { label: 'Nghiêm trọng', className: 'bg-red-100 text-red-700', icon: AlertTriangle },
  CRITICAL: { label: 'Cực kỳ nghiêm trọng', className: 'bg-red-200 text-red-800', icon: Ban },
};

// Change type config
const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; icon: typeof Tag; className: string }> = {
  price_change: { label: 'Sửa giá', icon: Tag, className: 'text-orange-600' },
  stock_change: { label: 'Sửa kho', icon: Box, className: 'text-blue-600' },
  status_change: { label: 'Trạng thái', icon: FileText, className: 'text-purple-600' },
  content_change: { label: 'Nội dung', icon: FileText, className: 'text-slate-600' },
  violation: { label: 'Vi phạm', icon: Ban, className: 'text-red-600' },
  product_created: { label: 'Mới tạo', icon: Plus, className: 'text-green-600' },
  product_deleted: { label: 'Đã xóa', icon: Trash2, className: 'text-red-600' },
  model_change: { label: 'Phân loại', icon: Package, className: 'text-indigo-600' },
};

// Helper functions
function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProductHistoryPanel({ shopId, userId }: ProductHistoryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Query keys
  const historyQueryKey = ['product-history', shopId, filterType, showUnreadOnly, currentPage];
  const statsQueryKey = ['product-history-stats', shopId];

  // Fetch history logs
  const { data: historyData, isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: historyQueryKey,
    queryFn: async () => {
      let query = supabase
        .from('apishopee_product_history_logs')
        .select('*', { count: 'exact' })
        .eq('shop_id', shopId)
        .order('detected_at', { ascending: false });

      if (filterType !== 'ALL') {
        query = query.eq('change_type', filterType);
      }

      if (showUnreadOnly) {
        query = query.eq('is_read', false);
      }

      // Pagination
      const offset = (currentPage - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        logs: (data || []) as HistoryLog[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    enabled: !!shopId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_history_stats', { p_shop_id: shopId });

      if (error) throw error;

      return (data?.[0] || data) as HistoryStats | null;
    },
    enabled: !!shopId,
    staleTime: 60 * 1000, // 1 minute
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (logIds: string[]) => {
      const { error } = await supabase
        .from('apishopee_product_history_logs')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', logIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('apishopee_product_history_logs')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('shop_id', shopId)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      toast({ title: 'Đã đánh dấu tất cả là đã đọc' });
    },
  });

  // Subscribe to realtime changes
  useEffect(() => {
    if (!shopId) return;

    const channel = supabase
      .channel(`product_history_${shopId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apishopee_product_history_logs',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: historyQueryKey });
          queryClient.invalidateQueries({ queryKey: statsQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, queryClient, historyQueryKey, statsQueryKey]);

  // Filter logs by search term
  const filteredLogs = useMemo(() => {
    if (!historyData?.logs || !searchTerm) return historyData?.logs || [];

    const term = searchTerm.toLowerCase();
    return historyData.logs.filter(log =>
      log.item_name?.toLowerCase().includes(term) ||
      log.item_id.toString().includes(term) ||
      log.change_summary?.toLowerCase().includes(term)
    );
  }, [historyData?.logs, searchTerm]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, showUnreadOnly, searchTerm]);

  // Handle mark as read
  const handleMarkAsRead = (logId: string) => {
    markAsReadMutation.mutate([logId]);
  };

  // Render log item
  const renderLogItem = (log: HistoryLog) => {
    const changeConfig = CHANGE_TYPE_CONFIG[log.change_type];
    const severityConfig = SEVERITY_CONFIG[log.severity];
    const ChangeIcon = changeConfig.icon;

    return (
      <div
        key={log.id}
        className={cn(
          'border-b last:border-b-0 p-4 hover:bg-slate-50/50 transition-colors',
          !log.is_read && 'bg-blue-50/30 border-l-4 border-l-blue-500'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('p-2 rounded-lg bg-slate-100 flex-shrink-0', changeConfig.className)}>
            <ChangeIcon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs px-2 py-0.5 rounded-full', severityConfig.className)}>
                  {changeConfig.label}
                </span>
                {log.is_anomaly && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Bất thường
                  </span>
                )}
                {log.severity !== 'INFO' && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', severityConfig.className)}>
                    {severityConfig.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-400" title={formatDateTime(log.detected_at)}>
                  {formatRelativeTime(log.detected_at)}
                </span>
                {!log.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(log.id)}
                    className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                    title="Đánh dấu đã đọc"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Product info */}
            <div className="mb-1">
              <span className="text-sm font-medium text-slate-800 line-clamp-1">
                {log.item_name || `Sản phẩm #${log.item_id}`}
              </span>
              {log.model_name && (
                <span className="text-xs text-slate-500 ml-2">
                  ({log.model_name})
                </span>
              )}
            </div>

            {/* Change summary */}
            <p className="text-sm text-slate-600 mb-2">
              {log.change_summary}
            </p>

            {/* Change details */}
            {log.change_type === 'price_change' && log.old_value && log.new_value && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 line-through">
                  {formatPrice(log.old_value.current_price as number)}
                </span>
                <span className="text-slate-400">→</span>
                <span className={cn(
                  'font-medium',
                  (log.new_value.current_price as number) < (log.old_value.current_price as number)
                    ? 'text-red-600'
                    : 'text-green-600'
                )}>
                  {formatPrice(log.new_value.current_price as number)}
                </span>
                {(log.new_value.current_price as number) < (log.old_value.current_price as number) ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
              </div>
            )}

            {log.change_type === 'stock_change' && log.old_value && log.new_value && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">
                  {log.old_value.total_available_stock as number} sp
                </span>
                <span className="text-slate-400">→</span>
                <span className={cn(
                  'font-medium',
                  (log.new_value.total_available_stock as number) === 0
                    ? 'text-red-600'
                    : (log.new_value.total_available_stock as number) < (log.old_value.total_available_stock as number)
                      ? 'text-yellow-600'
                      : 'text-green-600'
                )}>
                  {log.new_value.total_available_stock as number} sp
                </span>
              </div>
            )}

            {/* Violation details */}
            {log.change_type === 'violation' && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg text-sm">
                <p className="text-red-700 font-medium">{log.violation_type}</p>
                {log.violation_reason && (
                  <p className="text-red-600 text-xs mt-1">{log.violation_reason}</p>
                )}
                {log.violation_suggestion && (
                  <p className="text-slate-600 text-xs mt-1 italic">
                    Gợi ý: {log.violation_suggestion}
                  </p>
                )}
              </div>
            )}

            {/* Anomaly reason */}
            {log.is_anomaly && log.anomaly_reason && (
              <div className="mt-2 p-2 bg-orange-50 rounded-lg text-sm text-orange-700">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                {log.anomaly_reason}
              </div>
            )}

            {/* Source badge */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                {log.source === 'webhook' ? 'Webhook' : log.source === 'api_sync' ? 'API Sync' : 'Kiểm tra'}
              </span>
              <span className="text-[10px] text-slate-400">•</span>
              <span className="text-[10px] text-slate-400">
                ID: {log.item_id}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
      <CardContent className="p-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0">
          {/* Stats bar */}
          {stats && (
            <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b flex items-center gap-4 overflow-x-auto">
              <div className="flex items-center gap-1.5 text-xs">
                <Bell className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-600">Chưa đọc:</span>
                <span className="font-semibold text-blue-600">{stats.unread_count}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-slate-600">Cảnh báo:</span>
                <span className="font-semibold text-yellow-600">{stats.warning_count}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Ban className="w-3.5 h-3.5 text-red-500" />
                <span className="text-slate-600">Vi phạm:</span>
                <span className="font-semibold text-red-600">{stats.violations}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Tag className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-slate-600">Sửa giá:</span>
                <span className="font-semibold text-orange-600">{stats.price_changes}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Box className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-600">Sửa kho:</span>
                <span className="font-semibold text-blue-600">{stats.stock_changes}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-600">Hôm nay:</span>
                <span className="font-semibold text-slate-700">{stats.today_count}</span>
              </div>
            </div>
          )}

          {/* Filter tabs + Actions */}
          <div className="flex items-center justify-between border-b bg-white px-2 gap-2">
            {/* Tabs */}
            <div className="flex items-center flex-shrink-0 overflow-x-auto">
              {FILTER_TABS.map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilterType(tab.key)}
                    className={cn(
                      'px-3 md:px-4 py-3 text-xs md:text-sm whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5',
                      filterType === tab.key
                        ? 'border-orange-500 text-orange-600 font-medium'
                        : 'border-transparent text-slate-600 hover:text-slate-800'
                    )}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 py-2">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Tìm theo tên, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs w-40 lg:w-52"
                />
              </div>

              {/* Toggle unread only */}
              <Button
                variant={showUnreadOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                className={cn('h-8 text-xs', showUnreadOnly && 'bg-blue-500 hover:bg-blue-600')}
              >
                {showUnreadOnly ? <BellOff className="w-3.5 h-3.5 mr-1" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
                <span className="hidden md:inline">{showUnreadOnly ? 'Tất cả' : 'Chưa đọc'}</span>
              </Button>

              {/* Mark all as read */}
              {stats && stats.unread_count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="h-8 text-xs"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden md:inline">Đọc hết</span>
                </Button>
              )}

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHistory()}
                disabled={loadingHistory}
                className="h-8 text-xs"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loadingHistory && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Mobile Search */}
          <div className="md:hidden p-2 border-b bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Tìm theo tên hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm h-9"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {loadingHistory && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
              <span className="ml-2 text-slate-500">Đang tải...</span>
            </div>
          )}

          {/* Empty */}
          {!loadingHistory && filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <History className="h-12 w-12 mb-3" />
              <p className="mb-2">Chưa có lịch sử thay đổi</p>
              <p className="text-sm text-slate-400">
                {showUnreadOnly
                  ? 'Tất cả thông báo đã được đọc'
                  : 'Các thay đổi sẽ được ghi nhận khi đồng bộ sản phẩm'}
              </p>
            </div>
          )}

          {/* Log list */}
          {!loadingHistory && filteredLogs.length > 0 && (
            <div>
              {filteredLogs.map(renderLogItem)}
            </div>
          )}
        </div>

        {/* Pagination */}
        {historyData && historyData.totalPages > 1 && (
          <div className="px-3 md:px-4 py-2 md:py-3 border-t bg-slate-50/50 flex items-center justify-between">
            <div className="text-xs md:text-sm text-slate-500">
              Trang {currentPage} / {historyData.totalPages} ({historyData.total} bản ghi)
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7 md:h-8 md:w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page numbers - Desktop */}
              <div className="hidden md:flex items-center gap-1">
                {Array.from({ length: Math.min(5, historyData.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (historyData.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= historyData.totalPages - 2) {
                    pageNum = historyData.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        'h-8 w-8 p-0',
                        currentPage === pageNum && 'bg-orange-500 hover:bg-orange-600'
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              {/* Page indicator - Mobile */}
              <span className="md:hidden text-xs text-slate-600 min-w-[60px] text-center">
                {currentPage} / {historyData.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(historyData.totalPages, p + 1))}
                disabled={currentPage === historyData.totalPages}
                className="h-7 w-7 md:h-8 md:w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductHistoryPanel;
