/**
 * FlashSalePanel - UI component cho quản lý Flash Sale
 * Giao diện theo mẫu Shopee Seller Center
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trash2, Eye, Clock, Calendar, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DataTable, DataTablePaginationInfo } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSyncData } from '@/hooks/useSyncData';
import { useFlashSaleData } from '@/hooks/useRealtimeData';
import { supabase } from '@/lib/supabase';
import { logCompletedActivity } from '@/lib/activity-logger';
import {
  FlashSale,
  FilterType,
  TYPE_LABELS,
  TYPE_PRIORITY,
  ERROR_MESSAGES,
} from '@/lib/shopee/flash-sale/types';
import {
  withDynamicType,
  deduplicateByTimeslot,
} from '@/lib/shopee/flash-sale/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreateFlashSalePanel } from './CreateFlashSalePanel';
import { FlashSaleDetailPanel } from './FlashSaleDetailPanel';
import { AutoSetupDialog } from '@/components/dialogs/AutoSetupDialog';
import { cn } from '@/lib/utils';

interface FlashSalePanelProps {
  shopId: number;
  userId: string;
}

// Tab filter options
const TABS = [
  { value: '0' as FilterType, label: 'Tất cả' },
  { value: '2' as FilterType, label: 'Đang diễn ra' },
  { value: '1' as FilterType, label: 'Sắp diễn ra' },
  { value: '3' as FilterType, label: 'Đã kết thúc' },
];

// Format timestamp to readable date/time
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Check if flash sale can be deleted (only upcoming)
function canDelete(sale: FlashSale): boolean {
  return sale.type === 1;
}

// Check if flash sale can be toggled (only upcoming or ongoing)
function canToggle(sale: FlashSale): boolean {
  return sale.type === 1 || sale.type === 2;
}

// Get error message with optional Shopee message for context
function getErrorMessage(error: string, message?: string): string {
  const mapped = ERROR_MESSAGES[error];
  if (mapped) return mapped;
  return message || error;
}

// Auto sync interval: 30 minutes in milliseconds
const AUTO_SYNC_INTERVAL = 30 * 60 * 1000;

export function FlashSalePanel({ shopId, userId }: FlashSalePanelProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<FilterType>('0');
  const [selectedSale, setSelectedSale] = useState<FlashSale | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // View state
  const [view, setView] = useState<'list' | 'create'>('list');

  // Auto setup dialog state
  const [showAutoSetupDialog, setShowAutoSetupDialog] = useState(false);
  const [copyFromFlashSaleId, setCopyFromFlashSaleId] = useState<number | null>(null);

  // Detail modal state
  const [detailFlashSale, setDetailFlashSale] = useState<FlashSale | null>(null);

  // Desktop pagination info (from DataTable)
  const [paginationInfo, setPaginationInfo] = useState<DataTablePaginationInfo | null>(null);

  // Mobile pagination
  const [mobilePage, setMobilePage] = useState(1);
  const MOBILE_PAGE_SIZE = 10;  // Hooks - Không tự động sync, người dùng phải nhấn nút "Làm mới"
  const { isSyncing, triggerSync, lastSyncedAt } = useSyncData({
    shopId,
    userId,
    autoSyncOnMount: false,
  });

  const { data: flashSales, loading, error, refetch, dataUpdatedAt } = useFlashSaleData(shopId, userId);

  // Auto sync from Shopee API every 30 minutes
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing interval
    if (autoSyncIntervalRef.current) {
      clearInterval(autoSyncIntervalRef.current);
    }

    // Set up auto sync interval
    autoSyncIntervalRef.current = setInterval(async () => {
      console.log('[FlashSalePanel] Auto-sync triggered (every 30 minutes)');
      try {
        // Sync từ Shopee API
        await triggerSync(true);
        // Refetch data từ database để hiển thị UI
        await refetch();
      } catch (err) {
        console.error('[FlashSalePanel] Auto-sync error:', err);
      }
    }, AUTO_SYNC_INTERVAL);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [shopId, userId, triggerSync, refetch]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    // 1. Apply dynamic type calculation based on current time
    let result = (flashSales as unknown as FlashSale[]).map(sale => withDynamicType(sale));

    // 2. Deduplicate by timeslot_id - keep only the most relevant flash sale per timeslot
    result = deduplicateByTimeslot(result);

    // 3. Filter by tab
    if (activeTab !== '0') {
      result = result.filter(s => s.type === Number(activeTab));
    }

    // 4. Sort by priority (Ongoing > Upcoming > Expired)
    result.sort((a, b) => (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99));

    return result;
  }, [flashSales, activeTab]);

  // Mobile paginated data
  const mobileData = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    const end = start + MOBILE_PAGE_SIZE;
    return filteredData.slice(start, end);
  }, [filteredData, mobilePage]);

  const mobileTotalPages = Math.ceil(filteredData.length / MOBILE_PAGE_SIZE);

  // Reset mobile page when tab changes
  useEffect(() => {
    setMobilePage(1);
  }, [activeTab]);

  // Count by type (using deduplicated and dynamically typed data)
  const counts = useMemo(() => {
    // Apply same processing as filteredData for accurate counts
    const processed = deduplicateByTimeslot(
      (flashSales as unknown as FlashSale[]).map(sale => withDynamicType(sale))
    );
    return {
      all: processed.length,
      ongoing: processed.filter(s => s.type === 2).length,
      upcoming: processed.filter(s => s.type === 1).length,
      expired: processed.filter(s => s.type === 3).length,
    };
  }, [flashSales]);

  // Handle toggle status
  const handleToggleStatus = async (sale: FlashSale) => {
    if (!canToggle(sale)) return;

    setTogglingId(sale.flash_sale_id);
    const startTime = new Date();
    // Status: 1 = Enabled, 2 = Disabled - handle cả string và number
    const currentStatus = Number(sale.status);
    const newStatus = currentStatus === 1 ? 2 : 1;

    try {
      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: {
          action: 'update-flash-sale',
          shop_id: shopId,
          flash_sale_id: sale.flash_sale_id,
          status: newStatus,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(getErrorMessage(data.error, data.message));

      // Update local DB
      await supabase
        .from('apishopee_flash_sale_data')
        .update({ status: newStatus })
        .eq('id', sale.id);

      toast({
        title: 'Thành công',
        description: `Đã ${newStatus === 1 ? 'bật' : 'tắt'} Flash Sale`,
      });

      // Log activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'flash_sale_toggle',
        actionCategory: 'flash_sale',
        actionDescription: `${newStatus === 1 ? 'Bật' : 'Tắt'} Flash Sale #${sale.flash_sale_id}`,
        status: 'success',
        source: 'manual',
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        targetType: 'flash_sale',
        targetId: String(sale.flash_sale_id),
      });

      refetch();
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });

      // Log failed activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'flash_sale_toggle',
        actionCategory: 'flash_sale',
        actionDescription: `${newStatus === 1 ? 'Bật' : 'Tắt'} Flash Sale thất bại`,
        status: 'failed',
        source: 'manual',
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        errorMessage: (err as Error).message,
      });
    } finally {
      setTogglingId(null);
    }
  };

  // Handle delete
  const handleDeleteClick = (sale: FlashSale) => {
    if (!canDelete(sale)) {
      toast({
        title: 'Không thể xóa',
        description: 'Chỉ có thể xóa Flash Sale "Sắp diễn ra"',
        variant: 'destructive',
      });
      return;
    }
    setSelectedSale(sale);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSale) return;

    setIsDeleting(true);
    const startTime = new Date();
    const flashSaleId = selectedSale.flash_sale_id;

    try {
      const { data, error } = await supabase.functions.invoke('apishopee-flash-sale', {
        body: {
          action: 'delete-flash-sale',
          shop_id: shopId,
          flash_sale_id: flashSaleId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(getErrorMessage(data.error, data.message));

      await supabase
        .from('apishopee_flash_sale_data')
        .delete()
        .eq('id', selectedSale.id);

      toast({ title: 'Thành công', description: 'Đã xóa Flash Sale' });

      // Log activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'flash_sale_delete',
        actionCategory: 'flash_sale',
        actionDescription: `Xóa Flash Sale #${flashSaleId}`,
        status: 'success',
        source: 'manual',
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        targetType: 'flash_sale',
        targetId: String(flashSaleId),
      });

      refetch();
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });

      // Log failed activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'flash_sale_delete',
        actionCategory: 'flash_sale',
        actionDescription: `Xóa Flash Sale #${flashSaleId} thất bại`,
        status: 'failed',
        source: 'manual',
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        errorMessage: (err as Error).message,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSelectedSale(null);
    }
  };

  // Handle view detail - open modal
  const handleViewDetail = (sale: FlashSale) => {
    setDetailFlashSale(sale);
  };

  // Handle back to list
  const handleBackToList = () => {
    setView('list');
    // Data sẽ tự động được fetch lại bởi useRealtimeData hook
  };

  // Handle Copy - open auto setup dialog with flash sale id to copy from
  const handleCopy = (sale: FlashSale) => {
    setCopyFromFlashSaleId(sale.flash_sale_id);
    setShowAutoSetupDialog(true);
  };

  // Handle auto setup dialog close
  const handleAutoSetupClose = (open: boolean) => {
    setShowAutoSetupDialog(open);
    if (!open) {
      setCopyFromFlashSaleId(null);
    }
  };

  // Handle auto setup success - sync lại dữ liệu từ Shopee để hiển thị FS mới tạo
  const handleAutoSetupSuccess = async () => {
    await triggerSync(true);
    await refetch();
  };

  // Table columns: Khung giờ, Trạng thái, Số lượng SP, Thao tác
  const columns: ColumnDef<FlashSale>[] = [
    {
      accessorKey: 'start_time',
      header: 'Khung giờ',
      size: 200,
      cell: ({ row }) => {
        const { start_time, end_time, flash_sale_id } = row.original;
        const sameDay = formatDate(start_time) === formatDate(end_time);
        return (
          <div className="text-sm whitespace-nowrap">
            <div className="font-medium text-slate-700">
              {formatTime(start_time)} {formatDate(start_time)} - {sameDay ? formatTime(end_time) : formatDateTime(end_time)}
            </div>
            <div className="text-xs text-slate-400">
              {flash_sale_id}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Trạng thái',
      size: 120,
      cell: ({ row }) => {
        const type = row.original.type;
        const config = {
          2: { label: 'Đang chạy', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
          1: { label: 'Sắp tới', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
          3: { label: 'Kết thúc', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
        }[type] || { label: 'Không rõ', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' };

        return (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </div>
        );
      },
    },
    {
      accessorKey: 'items',
      header: 'Số lượng SP',
      size: 120,
      cell: ({ row }) => (
        <div className="text-sm text-center whitespace-nowrap">
          <span className="text-orange-600 font-medium">{row.original.enabled_item_count}</span>
          <span className="text-slate-400">/{row.original.item_count}</span>
        </div>
      ),
    },
    {
      accessorKey: 'actions',
      header: 'Thao tác',
      size: 130,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-orange-600"
                  onClick={() => handleViewDetail(row.original)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Xem chi tiết</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-green-600"
                  onClick={() => handleCopy(row.original)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sao chép vào cài FS tự động</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-red-600"
                  onClick={() => handleDeleteClick(row.original)}
                  disabled={!canDelete(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canDelete(row.original) ? 'Xóa' : 'Chỉ xóa được Flash Sale sắp diễn ra'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ];

  // Render create view
  if (view === 'create') {
    return (
      <CreateFlashSalePanel
        shopId={shopId}
        userId={userId}
        onBack={handleBackToList}
        onCreated={handleBackToList}
      />
    );
  }

  return (
    <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
      <CardContent className="p-0 flex flex-col h-full overflow-hidden">
        {/* Sticky Header Section */}
        <div className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Pagination - left side */}
            <div className="hidden md:flex items-center gap-1">
              {paginationInfo && paginationInfo.pageCount > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={paginationInfo.previousPage}
                    disabled={!paginationInfo.canPreviousPage}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(5, paginationInfo.pageCount) }, (_, i) => {
                    const pageIndex = paginationInfo.pageIndex;
                    const pageCount = paginationInfo.pageCount;
                    let pageNum: number;

                    if (pageCount <= 5) {
                      pageNum = i;
                    } else if (pageIndex < 3) {
                      pageNum = i;
                    } else if (pageIndex > pageCount - 4) {
                      pageNum = pageCount - 5 + i;
                    } else {
                      pageNum = pageIndex - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={pageIndex === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => paginationInfo.setPageIndex(pageNum)}
                        className={cn(
                          "h-8 w-8 p-0",
                          pageIndex === pageNum && "bg-orange-500 hover:bg-orange-600"
                        )}
                      >
                        {pageNum + 1}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={paginationInfo.nextPage}
                    disabled={!paginationInfo.canNextPage}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Filter + Sync - right side */}
            <div className="flex items-center gap-2 ml-auto">
              <Select value={activeTab} onValueChange={(v) => setActiveTab(v as FilterType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABS.map((tab) => {
                    const count = tab.value === '0' ? counts.all
                      : tab.value === '2' ? counts.ongoing
                        : tab.value === '1' ? counts.upcoming
                          : counts.expired;
                    return (
                      <SelectItem key={tab.value} value={tab.value}>
                        {tab.label}{count > 0 ? ` (${count})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await triggerSync(true);
                  await refetch();
                }}
                disabled={isSyncing || loading}
                className="bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-600"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", (isSyncing || loading) && "animate-spin")} />
                {isSyncing ? 'Đang đồng bộ...' : 'Lấy dữ liệu'}
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile List View */}
          <div className="md:hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>
          ) : filteredData.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {counts.all === 0
                ? 'Chưa có Flash Sale nào. Nhấn "Lấy dữ liệu" để đồng bộ.'
                : 'Không có Flash Sale nào phù hợp.'}
            </div>
          ) : (
            <div className="divide-y">
              {mobileData.map((sale) => {
                const startDate = new Date(sale.start_time * 1000);
                const endDate = new Date(sale.end_time * 1000);
                const dateStr = startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const startTimeStr = startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const endTimeStr = endDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={sale.flash_sale_id} className="p-4 bg-white">
                    {/* Row 1: Date + Time + Toggle */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {startTimeStr} - {endTimeStr}
                        </span>
                      </div>
                      <Switch
                        checked={Number(sale.status) === 1}
                        onCheckedChange={() => handleToggleStatus(sale)}
                        disabled={!canToggle(sale) || togglingId === sale.flash_sale_id}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </div>

                    {/* Row 2: Badge + ID + Product count */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        sale.type === 2 ? "bg-green-100 text-green-700" :
                          sale.type === 1 ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-600"
                      )}>
                        {TYPE_LABELS[sale.type]}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        #{sale.flash_sale_id}
                      </span>
                      <span className="text-xs text-slate-500 ml-auto">
                        <span className={cn(
                          "font-medium",
                          sale.enabled_item_count > 0 ? "text-orange-600" : "text-slate-400"
                        )}>
                          {sale.enabled_item_count}
                        </span>
                        <span className="text-slate-400">/{sale.item_count} SP</span>
                      </span>
                    </div>

                    {/* Row 3: Actions */}
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleViewDetail(sale)}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Chi tiết
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-green-600 border-green-200"
                        onClick={() => handleCopy(sale)}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Sao chép
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-600"
                        onClick={() => handleDeleteClick(sale)}
                        disabled={!canDelete(sale)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Xóa
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Pagination */}
              {mobileTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobilePage(p => Math.max(1, p - 1))}
                    disabled={mobilePage === 1}
                    className="h-8"
                  >
                    ← Trước
                  </Button>
                  <span className="text-sm text-slate-500">
                    {mobilePage} / {mobileTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobilePage(p => Math.min(mobileTotalPages, p + 1))}
                    disabled={mobilePage === mobileTotalPages}
                    className="h-8"
                  >
                    Sau →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filteredData}
              loading={loading}
              loadingMessage="Đang tải dữ liệu..."
              emptyMessage={
                counts.all === 0
                  ? 'Chưa có Flash Sale nào. Nhấn "Lấy dữ liệu từ Shopee" để đồng bộ.'
                  : 'Không có Flash Sale nào phù hợp với bộ lọc.'
              }
              pageSize={20}
              showPagination={false}
              onPaginationChange={setPaginationInfo}
            />
          </div>

          {/* Last sync info */}
          {(lastSyncedAt || dataUpdatedAt) && (
            <div className="px-4 py-2 border-t bg-slate-50/50 text-xs text-slate-400 flex items-center justify-between">
              <span>
                {lastSyncedAt && `Đồng bộ Shopee: ${formatDateTime(new Date(lastSyncedAt).getTime() / 1000)}`}
                {lastSyncedAt && dataUpdatedAt && ' • '}
                {dataUpdatedAt && `Cập nhật UI: ${formatDateTime(dataUpdatedAt / 1000)}`}
              </span>
              <span className="text-slate-300">
                Tự động làm mới mỗi 30 phút
              </span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa Flash Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa Flash Sale này?
              <br />
              <span className="font-mono text-slate-600">ID: {selectedSale?.flash_sale_id}</span>
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto Setup Dialog */}
      <AutoSetupDialog
        open={showAutoSetupDialog}
        onOpenChange={handleAutoSetupClose}
        shopId={shopId}
        userId={userId}
        copyFromFlashSaleId={copyFromFlashSaleId}
        onSuccess={handleAutoSetupSuccess}
      />

      {/* Detail Modal */}
      <Dialog open={!!detailFlashSale} onOpenChange={(open) => !open && setDetailFlashSale(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
          {detailFlashSale && (
            <FlashSaleDetailPanel
              shopId={shopId}
              flashSale={detailFlashSale}
              onBack={() => setDetailFlashSale(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default FlashSalePanel;
