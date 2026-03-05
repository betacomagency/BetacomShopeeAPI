/**
 * FlashSalePanel - UI component cho quản lý Flash Sale
 * Giao diện theo mẫu Shopee Seller Center
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { RefreshCw, Trash2, Eye, Clock, Calendar as CalendarIcon, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSyncData } from "@/hooks/useSyncData";
import { useFlashSaleData } from "@/hooks/useRealtimeData";
import { supabase } from "@/lib/supabase";
import { logCompletedActivity } from "@/lib/activity-logger";
import {
  FlashSale,
  FilterType,
  TYPE_LABELS,
  TYPE_PRIORITY,
  ERROR_MESSAGES,
} from "@/lib/shopee/flash-sale/types";
import {
  withDynamicType,
  deduplicateByTimeslot,
} from "@/lib/shopee/flash-sale/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CreateFlashSalePanel } from "./CreateFlashSalePanel";
import { FlashSaleDetailPanel } from "./FlashSaleDetailPanel";
import { AutoSetupDialog } from "@/components/dialogs/AutoSetupDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FlashSalePanelProps {
  shopId: number;
  userId: string;
}

// Tab filter options
const TABS = [
  { value: "0" as FilterType, label: "Tất cả" },
  { value: "2" as FilterType, label: "Đang diễn ra" },
  { value: "1" as FilterType, label: "Sắp diễn ra" },
  { value: "3" as FilterType, label: "Đã kết thúc" },
];

const DESKTOP_PAGE_SIZE = 20;
const MOBILE_PAGE_SIZE = 10;
const AUTO_SYNC_INTERVAL = 30 * 60 * 1000;

// ==================== HELPERS ====================

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function canDelete(sale: FlashSale): boolean {
  return sale.type === 1;
}

function canToggle(sale: FlashSale): boolean {
  return sale.type === 1 || sale.type === 2;
}

function getErrorMessage(error: string, message?: string): string {
  return ERROR_MESSAGES[error] || message || error;
}

function getPageNumbers(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3)
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

// ==================== COMPONENT ====================

export function FlashSalePanel({ shopId, userId }: FlashSalePanelProps) {
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState<FilterType>("0");
  const [selectedSale, setSelectedSale] = useState<FlashSale | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "create">("list");
  const [showAutoSetupDialog, setShowAutoSetupDialog] = useState(false);
  const [copyFromFlashSaleId, setCopyFromFlashSaleId] = useState<number | null>(
    null,
  );
  const [detailFlashSale, setDetailFlashSale] = useState<FlashSale | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  // Pagination
  const [desktopPage, setDesktopPage] = useState(1);
  const [mobilePage, setMobilePage] = useState(1);

  const { isSyncing, triggerSync, lastSyncedAt } = useSyncData({
    shopId,
    userId,
    autoSyncOnMount: false,
  });

  const {
    data: flashSales,
    loading,
    error,
    refetch,
    dataUpdatedAt,
  } = useFlashSaleData(shopId, userId);

  // Auto sync every 30 minutes
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoSyncIntervalRef.current) clearInterval(autoSyncIntervalRef.current);

    autoSyncIntervalRef.current = setInterval(async () => {
      try {
        await triggerSync(true);
        await refetch();
      } catch (err) {
        console.error("[FlashSalePanel] Auto-sync error:", err);
      }
    }, AUTO_SYNC_INTERVAL);

    return () => {
      if (autoSyncIntervalRef.current)
        clearInterval(autoSyncIntervalRef.current);
    };
  }, [shopId, userId, triggerSync, refetch]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let result = (flashSales as unknown as FlashSale[]).map((sale) =>
      withDynamicType(sale),
    );
    result = deduplicateByTimeslot(result);
    if (activeTab !== "0")
      result = result.filter((s) => s.type === Number(activeTab));
    if (dateFilter) {
      const startOfDay = new Date(dateFilter).setHours(0, 0, 0, 0) / 1000;
      const endOfDay = new Date(dateFilter).setHours(23, 59, 59, 999) / 1000;
      result = result.filter(
        (s) => s.start_time >= startOfDay && s.start_time <= endOfDay,
      );
    }
    result.sort(
      (a, b) => (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99),
    );
    return result;
  }, [flashSales, activeTab, dateFilter]);

  // Desktop pagination
  const desktopTotalPages = Math.max(
    1,
    Math.ceil(filteredData.length / DESKTOP_PAGE_SIZE),
  );
  const desktopData = useMemo(() => {
    const start = (desktopPage - 1) * DESKTOP_PAGE_SIZE;
    return filteredData.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [filteredData, desktopPage]);

  // Mobile pagination
  const mobileTotalPages = Math.max(
    1,
    Math.ceil(filteredData.length / MOBILE_PAGE_SIZE),
  );
  const mobileData = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return filteredData.slice(start, start + MOBILE_PAGE_SIZE);
  }, [filteredData, mobilePage]);

  // Reset pages when filter changes
  useEffect(() => {
    setDesktopPage(1);
    setMobilePage(1);
  }, [activeTab]);

  // Counts
  const counts = useMemo(() => {
    const processed = deduplicateByTimeslot(
      (flashSales as unknown as FlashSale[]).map((sale) =>
        withDynamicType(sale),
      ),
    );
    return {
      all: processed.length,
      ongoing: processed.filter((s) => s.type === 2).length,
      upcoming: processed.filter((s) => s.type === 1).length,
      expired: processed.filter((s) => s.type === 3).length,
    };
  }, [flashSales]);

  // ==================== HANDLERS ====================

  const handleToggleStatus = async (sale: FlashSale) => {
    if (!canToggle(sale)) return;
    setTogglingId(sale.flash_sale_id);
    const startTime = new Date();
    const newStatus = Number(sale.status) === 1 ? 2 : 1;

    try {
      const { data, error } = await supabase.functions.invoke(
        "apishopee-flash-sale",
        {
          body: {
            action: "update-flash-sale",
            shop_id: shopId,
            flash_sale_id: sale.flash_sale_id,
            status: newStatus,
          },
        },
      );
      if (error) throw error;
      if (data?.error)
        throw new Error(getErrorMessage(data.error, data.message));

      await supabase
        .from("apishopee_flash_sale_data")
        .update({ status: newStatus })
        .eq("id", sale.id);
      toast({
        title: "Thành công",
        description: `Đã ${newStatus === 1 ? "bật" : "tắt"} Flash Sale`,
      });

      logCompletedActivity({
        userId,
        shopId,
        actionType: "flash_sale_toggle",
        actionCategory: "flash_sale",
        actionDescription: `${newStatus === 1 ? "Bật" : "Tắt"} Flash Sale #${sale.flash_sale_id}`,
        status: "success",
        source: "manual",
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        targetType: "flash_sale",
        targetId: String(sale.flash_sale_id),
      });
      refetch();
    } catch (err) {
      toast({
        title: "Lỗi",
        description: (err as Error).message,
        variant: "destructive",
      });
      logCompletedActivity({
        userId,
        shopId,
        actionType: "flash_sale_toggle",
        actionCategory: "flash_sale",
        actionDescription: `${newStatus === 1 ? "Bật" : "Tắt"} Flash Sale thất bại`,
        status: "failed",
        source: "manual",
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        errorMessage: (err as Error).message,
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (sale: FlashSale) => {
    if (!canDelete(sale)) {
      toast({
        title: "Không thể xóa",
        description: 'Chỉ có thể xóa Flash Sale "Sắp diễn ra"',
        variant: "destructive",
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
      const { data, error } = await supabase.functions.invoke(
        "apishopee-flash-sale",
        {
          body: {
            action: "delete-flash-sale",
            shop_id: shopId,
            flash_sale_id: flashSaleId,
          },
        },
      );
      if (error) throw error;
      if (data?.error)
        throw new Error(getErrorMessage(data.error, data.message));

      await supabase
        .from("apishopee_flash_sale_data")
        .delete()
        .eq("id", selectedSale.id);
      toast({ title: "Thành công", description: "Đã xóa Flash Sale" });

      logCompletedActivity({
        userId,
        shopId,
        actionType: "flash_sale_delete",
        actionCategory: "flash_sale",
        actionDescription: `Xóa Flash Sale #${flashSaleId}`,
        status: "success",
        source: "manual",
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        targetType: "flash_sale",
        targetId: String(flashSaleId),
      });
      refetch();
    } catch (err) {
      toast({
        title: "Lỗi",
        description: (err as Error).message,
        variant: "destructive",
      });
      logCompletedActivity({
        userId,
        shopId,
        actionType: "flash_sale_delete",
        actionCategory: "flash_sale",
        actionDescription: `Xóa Flash Sale #${flashSaleId} thất bại`,
        status: "failed",
        source: "manual",
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

  const handleViewDetail = (sale: FlashSale) => setDetailFlashSale(sale);
  const handleBackToList = () => setView("list");
  const handleCopy = (sale: FlashSale) => {
    setCopyFromFlashSaleId(sale.flash_sale_id);
    setShowAutoSetupDialog(true);
  };
  const handleAutoSetupClose = (open: boolean) => {
    setShowAutoSetupDialog(open);
    if (!open) setCopyFromFlashSaleId(null);
  };
  const handleAutoSetupSuccess = async () => {
    await triggerSync(true);
    await refetch();
  };

  // ==================== RENDER ====================

  if (view === "create") {
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
        {/* Sticky Header */}
        <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-end gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-empty={!dateFilter}
                className="w-[160px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
              >
                {dateFilter ? format(dateFilter, "dd/MM/yyyy", { locale: vi }) : "Lọc theo ngày"}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={setDateFilter}
                defaultMonth={dateFilter}
              />
              {dateFilter && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setDateFilter(undefined)}
                  >
                    Xóa lọc ngày
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Select
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as FilterType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((tab) => {
                const count =
                  tab.value === "0"
                    ? counts.all
                    : tab.value === "2"
                      ? counts.ongoing
                      : tab.value === "1"
                        ? counts.upcoming
                        : counts.expired;
                return (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                    {count > 0 ? ` (${count})` : ""}
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
            className="bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-600">
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-2",
                (isSyncing || loading) && "animate-spin",
              )}
            />
            {isSyncing ? "Đang đồng bộ..." : "Lấy dữ liệu"}
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile List */}
          <div className="md:hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Đang tải dữ liệu...
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                {counts.all === 0
                  ? 'Chưa có Flash Sale nào. Nhấn "Lấy dữ liệu" để đồng bộ.'
                  : "Không có Flash Sale nào phù hợp."}
              </div>
            ) : (
              <div className="divide-y">
                {mobileData.map((sale) => {
                  const startDate = new Date(sale.start_time * 1000);
                  const endDate = new Date(sale.end_time * 1000);
                  const dateStr = startDate.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                  const startTimeStr = startDate.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endTimeStr = endDate.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={sale.flash_sale_id} className="p-4 bg-white">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
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
                          disabled={
                            !canToggle(sale) ||
                            togglingId === sale.flash_sale_id
                          }
                          className="data-[state=checked]:bg-green-500"
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            sale.type === 2
                              ? "bg-green-100 text-green-700"
                              : sale.type === 1
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-600",
                          )}>
                          {TYPE_LABELS[sale.type]}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          #{sale.flash_sale_id}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          <span
                            className={cn(
                              "font-medium",
                              sale.enabled_item_count > 0
                                ? "text-orange-600"
                                : "text-slate-400",
                            )}>
                            {sale.enabled_item_count}
                          </span>
                          <span className="text-slate-400">
                            /{sale.item_count} SP
                          </span>
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleViewDetail(sale)}>
                          <Eye className="w-3 h-3 mr-1" /> Chi tiết
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-green-600 border-green-200"
                          onClick={() => handleCopy(sale)}>
                          <Copy className="w-3 h-3 mr-1" /> Sao chép
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-600"
                          onClick={() => handleDeleteClick(sale)}
                          disabled={!canDelete(sale)}>
                          <Trash2 className="w-3 h-3 mr-1" /> Xóa
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {mobileTotalPages > 1 && (
                  <div className="px-4 py-3">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setMobilePage((p) => Math.max(1, p - 1))
                            }
                            className={cn(
                              "cursor-pointer",
                              mobilePage === 1 &&
                                "pointer-events-none opacity-50",
                            )}
                          />
                        </PaginationItem>
                        {getPageNumbers(mobilePage, mobileTotalPages).map(
                          (p, i) => (
                            <PaginationItem key={i}>
                              {p === "ellipsis" ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  isActive={mobilePage === p}
                                  onClick={() => setMobilePage(p as number)}
                                  className="cursor-pointer">
                                  {p}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ),
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setMobilePage((p) =>
                                Math.min(mobileTotalPages, p + 1),
                              )
                            }
                            className={cn(
                              "cursor-pointer",
                              mobilePage === mobileTotalPages &&
                                "pointer-events-none opacity-50",
                            )}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Đang tải dữ liệu...
              </div>
            ) : filteredData.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                {counts.all === 0
                  ? 'Chưa có Flash Sale nào. Nhấn "Lấy dữ liệu" để đồng bộ.'
                  : "Không có Flash Sale nào phù hợp với bộ lọc."}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Khung giờ</TableHead>
                      <TableHead className="w-[140px]">Trạng thái</TableHead>
                      <TableHead className="w-[120px] text-center">
                        Số lượng SP
                      </TableHead>
                      <TableHead className="w-[140px] text-center">
                        Thao tác
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {desktopData.map((sale) => {
                      const sameDay =
                        formatDate(sale.start_time) ===
                        formatDate(sale.end_time);
                      const typeConfig = {
                        2: {
                          label: "Đang chạy",
                          color:
                            "bg-emerald-50 text-emerald-700 border-emerald-200",
                          dot: "bg-emerald-500",
                          pulse: true,
                        },
                        1: {
                          label: "Sắp tới",
                          color: "bg-blue-50 text-blue-700 border-blue-200",
                          dot: "bg-blue-500",
                          pulse: false,
                        },
                        3: {
                          label: "Kết thúc",
                          color: "bg-slate-100 text-slate-500 border-slate-200",
                          dot: "bg-slate-400",
                          pulse: false,
                        },
                      }[sale.type] || {
                        label: "Không rõ",
                        color: "bg-slate-100 text-slate-500 border-slate-200",
                        dot: "bg-slate-400",
                        pulse: false,
                      };

                      return (
                        <TableRow key={sale.flash_sale_id}>
                          {/* Khung giờ & Mã phiên */}
                          <TableCell className="font-medium">
                            <div>
                              {formatTime(sale.start_time)}{" "}
                              {formatDate(sale.start_time)} –{" "}
                              {sameDay
                                ? formatTime(sale.end_time)
                                : formatDateTime(sale.end_time)}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              #{sale.flash_sale_id}
                            </div>
                          </TableCell>

                          {/* Trạng thái */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={typeConfig.color}>
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full mr-1",
                                  typeConfig.dot,
                                  typeConfig.pulse && "animate-pulse",
                                )}
                              />
                              {typeConfig.label}
                            </Badge>
                          </TableCell>

                          {/* Số lượng SP */}
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                sale.enabled_item_count > 0
                                  ? "text-orange-500"
                                  : "",
                              )}>
                              {sale.enabled_item_count}
                            </span>
                            <span className="text-muted-foreground">
                              /{sale.item_count}
                            </span>
                          </TableCell>

                          {/* Thao tác */}
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-400 hover:text-blue-600 cursor-pointer"
                                      onClick={() => handleViewDetail(sale)}>
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
                                      className="h-8 w-8 text-slate-400 hover:text-blue-600 cursor-pointer"
                                      onClick={() => handleCopy(sale)}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Sao chép vào cài FS tự động
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={cn(
                                        "h-8 w-8 cursor-pointer",
                                        canDelete(sale)
                                          ? "text-slate-400 hover:text-red-500"
                                          : "text-slate-200 cursor-not-allowed",
                                      )}
                                      onClick={() => handleDeleteClick(sale)}
                                      disabled={!canDelete(sale)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {canDelete(sale)
                                      ? "Xóa"
                                      : "Chỉ xóa được Flash Sale sắp diễn ra"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Desktop Pagination */}
                {desktopTotalPages > 1 && (
                  <div className="border-t px-4 py-3">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setDesktopPage((p) => Math.max(1, p - 1))
                            }
                            className={cn(
                              "cursor-pointer",
                              desktopPage === 1 &&
                                "pointer-events-none opacity-50",
                            )}
                          />
                        </PaginationItem>
                        {getPageNumbers(desktopPage, desktopTotalPages).map(
                          (p, i) => (
                            <PaginationItem key={i}>
                              {p === "ellipsis" ? (
                                <PaginationEllipsis />
                              ) : (
                                <PaginationLink
                                  isActive={desktopPage === p}
                                  onClick={() => setDesktopPage(p as number)}
                                  className="cursor-pointer">
                                  {p}
                                </PaginationLink>
                              )}
                            </PaginationItem>
                          ),
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setDesktopPage((p) =>
                                Math.min(desktopTotalPages, p + 1),
                              )
                            }
                            className={cn(
                              "cursor-pointer",
                              desktopPage === desktopTotalPages &&
                                "pointer-events-none opacity-50",
                            )}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Last sync info */}
          {(lastSyncedAt || dataUpdatedAt) && (
            <div className="px-4 py-2 border-t bg-slate-50/50 text-xs text-slate-400 flex items-center justify-between">
              <span>
                {lastSyncedAt &&
                  `Đồng bộ Shopee: ${formatDateTime(new Date(lastSyncedAt).getTime() / 1000)}`}
                {lastSyncedAt && dataUpdatedAt && " • "}
                {dataUpdatedAt &&
                  `Cập nhật UI: ${formatDateTime(dataUpdatedAt / 1000)}`}
              </span>
              <span className="text-slate-300">
                Tự động làm mới mỗi 30 phút
              </span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa Flash Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa Flash Sale này?
              <br />
              <span className="font-mono text-slate-600">
                ID: {selectedSale?.flash_sale_id}
              </span>
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600">
              {isDeleting ? "Đang xóa..." : "Xóa"}
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
      <Dialog
        open={!!detailFlashSale}
        onOpenChange={(open) => !open && setDetailFlashSale(null)}>
        <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden">
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
