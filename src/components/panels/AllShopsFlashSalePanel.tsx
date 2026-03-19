/**
 * AllShopsFlashSalePanel - Tổng quan Flash Sale tất cả shop (admin only, read-only)
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Eye, Clock, Calendar as CalendarIcon, ChevronDown, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useShopeeAuth } from "@/hooks/useShopeeAuth";
import {
  FlashSale,
  FilterType,
  TYPE_PRIORITY,
} from "@/lib/shopee/flash-sale/types";
import {
  withDynamicType,
  deduplicateByTimeslot,
} from "@/lib/shopee/flash-sale/utils";
import { FlashSaleDetailPanel } from "./FlashSaleDetailPanel";
import { cn } from "@/lib/utils";

interface AllShopsFlashSalePanelProps {
  userId: string;
}

// Auto history record from apishopee_flash_sale_auto_history
interface AutoHistoryRecord {
  id: string;
  shop_id: number;
  user_id: string;
  timeslot_id: number;
  flash_sale_id: number | null;
  status: 'pending' | 'scheduled' | 'processing' | 'success' | 'error';
  lead_time_minutes: number;
  scheduled_at: string | null;
  executed_at: string | null;
  slot_start_time: number;
  slot_end_time: number;
  items_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

type ExtFilterType = FilterType | 'scheduled';

const TABS: { value: ExtFilterType; label: string }[] = [
  { value: "0", label: "Tất cả" },
  { value: "2", label: "Đang diễn ra" },
  { value: "1", label: "Sắp tới" },
  { value: "scheduled", label: "Đã lên lịch" },
  { value: "3", label: "Đã kết thúc" },
];

const DESKTOP_PAGE_SIZE = 20;
const MOBILE_PAGE_SIZE = 10;

// ==================== HELPERS ====================

function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("vi-VN", {
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

function formatISODateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLeadTime(minutes: number): string {
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  return remainMins > 0 ? `${hours}h${remainMins}p trước` : `${hours} giờ trước`;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3)
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

const AUTO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Đang chờ", color: "bg-muted text-muted-foreground border-border" },
  scheduled: { label: "Đã lên lịch", color: "bg-info/10 text-info border-info" },
  processing: { label: "Đang xử lý", color: "bg-warning/10 text-warning border-warning" },
};

// ==================== COMPONENT ====================

export function AllShopsFlashSalePanel({ userId }: AllShopsFlashSalePanelProps) {
  const { shops } = useShopeeAuth();

  // State
  const [activeTab, setActiveTab] = useState<ExtFilterType>("0");
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [detailFlashSale, setDetailFlashSale] = useState<FlashSale | null>(null);

  // Pagination
  const [desktopPage, setDesktopPage] = useState(1);
  const [mobilePage, setMobilePage] = useState(1);

  // Shop name lookup
  const shopNameMap = useMemo(() => {
    const map = new Map<number, string>();
    shops.forEach((s) => map.set(s.shop_id, s.shop_name || `Shop #${s.shop_id}`));
    return map;
  }, [shops]);

  // Fetch all flash sales across all shops
  const {
    data: rawFlashSales,
    isLoading: loading,
    refetch: refetchFlashSales,
    dataUpdatedAt,
    isFetching,
  } = useQuery({
    queryKey: ["all-shops-flash-sales", userId],
    queryFn: async (): Promise<FlashSale[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("apishopee_flash_sale_data")
        .select("*")
        .order("start_time", { ascending: false });

      if (error) throw new Error(error.message);
      return (data as FlashSale[]) || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch auto history (scheduled/pending) across all shops
  const {
    data: autoHistory,
    isLoading: autoLoading,
    refetch: refetchAuto,
    isFetching: autoFetching,
  } = useQuery({
    queryKey: ["all-shops-auto-history"],
    queryFn: async (): Promise<AutoHistoryRecord[]> => {
      const { data, error } = await supabase
        .from("apishopee_flash_sale_auto_history")
        .select("*")
        .in("status", ["scheduled", "pending"])
        .order("slot_start_time", { ascending: true });

      if (error) throw error;
      return (data || []) as AutoHistoryRecord[];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(() => {
    refetchFlashSales();
    refetchAuto();
  }, [refetchFlashSales, refetchAuto]);

  // Filter auto history by shop and date
  const filteredAutoHistory = useMemo(() => {
    if (!autoHistory) return [];
    let result = [...autoHistory];

    if (shopFilter !== "all") {
      result = result.filter((r) => r.shop_id === Number(shopFilter));
    }
    if (dateFilter) {
      const startOfDay = new Date(dateFilter).setHours(0, 0, 0, 0) / 1000;
      const endOfDay = new Date(dateFilter).setHours(23, 59, 59, 999) / 1000;
      result = result.filter(
        (r) => r.slot_start_time >= startOfDay && r.slot_start_time <= endOfDay,
      );
    }
    return result;
  }, [autoHistory, shopFilter, dateFilter]);

  // Process and filter flash sale data
  const filteredData = useMemo(() => {
    if (!rawFlashSales) return [];

    let result = rawFlashSales.map((sale) => withDynamicType(sale));
    result = deduplicateByTimeslot(result);

    // Shop filter
    if (shopFilter !== "all") {
      result = result.filter((s) => s.shop_id === Number(shopFilter));
    }

    // Status filter (only for non-scheduled tabs)
    if (activeTab !== "0" && activeTab !== "scheduled") {
      result = result.filter((s) => s.type === Number(activeTab));
    }

    // Date filter
    if (dateFilter) {
      const startOfDay = new Date(dateFilter).setHours(0, 0, 0, 0) / 1000;
      const endOfDay = new Date(dateFilter).setHours(23, 59, 59, 999) / 1000;
      result = result.filter(
        (s) => s.start_time >= startOfDay && s.start_time <= endOfDay,
      );
    }

    // Sort: ongoing > upcoming > expired
    result.sort(
      (a, b) => (TYPE_PRIORITY[a.type] || 99) - (TYPE_PRIORITY[b.type] || 99),
    );

    return result;
  }, [rawFlashSales, activeTab, shopFilter, dateFilter]);

  // Counts
  const counts = useMemo(() => {
    if (!rawFlashSales) return { all: 0, ongoing: 0, upcoming: 0, scheduled: 0, expired: 0 };

    const processed = deduplicateByTimeslot(
      rawFlashSales.map((sale) => withDynamicType(sale)),
    );
    const filtered = shopFilter !== "all"
      ? processed.filter((s) => s.shop_id === Number(shopFilter))
      : processed;

    return {
      all: filtered.length,
      ongoing: filtered.filter((s) => s.type === 2).length,
      upcoming: filtered.filter((s) => s.type === 1).length,
      scheduled: filteredAutoHistory.length,
      expired: filtered.filter((s) => s.type === 3).length,
    };
  }, [rawFlashSales, shopFilter, filteredAutoHistory]);

  // Determine which dataset to paginate
  const isScheduledTab = activeTab === "scheduled";

  // Desktop pagination
  const desktopTotal = isScheduledTab ? filteredAutoHistory.length : filteredData.length;
  const desktopTotalPages = Math.max(1, Math.ceil(desktopTotal / DESKTOP_PAGE_SIZE));
  const desktopData = useMemo(() => {
    const start = (desktopPage - 1) * DESKTOP_PAGE_SIZE;
    return filteredData.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [filteredData, desktopPage]);
  const desktopAutoData = useMemo(() => {
    const start = (desktopPage - 1) * DESKTOP_PAGE_SIZE;
    return filteredAutoHistory.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [filteredAutoHistory, desktopPage]);

  // Mobile pagination
  const mobileTotal = isScheduledTab ? filteredAutoHistory.length : filteredData.length;
  const mobileTotalPages = Math.max(1, Math.ceil(mobileTotal / MOBILE_PAGE_SIZE));
  const mobileData = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return filteredData.slice(start, start + MOBILE_PAGE_SIZE);
  }, [filteredData, mobilePage]);
  const mobileAutoData = useMemo(() => {
    const start = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    return filteredAutoHistory.slice(start, start + MOBILE_PAGE_SIZE);
  }, [filteredAutoHistory, mobilePage]);

  // Reset pages when filter changes
  const resetPages = useCallback(() => {
    setDesktopPage(1);
    setMobilePage(1);
  }, []);

  const handleTabChange = (v: string) => {
    setActiveTab(v as ExtFilterType);
    resetPages();
  };

  const handleShopFilterChange = (v: string) => {
    setShopFilter(v);
    resetPages();
  };

  const isFetchingAny = isFetching || autoFetching;

  // ==================== RENDER ====================

  return (
    <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
      <CardContent className="p-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Store className="h-4 w-4" />
            <span className="font-medium">{counts.all} Flash Sale</span>
            <span>từ {shops.length} shop</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Shop filter */}
            <Select value={shopFilter} onValueChange={handleShopFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tất cả shop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả shop</SelectItem>
                {shops.map((shop) => (
                  <SelectItem key={shop.shop_id} value={String(shop.shop_id)}>
                    {shop.shop_name || `Shop #${shop.shop_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date filter */}
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
                  onSelect={(d) => { setDateFilter(d); resetPages(); }}
                  defaultMonth={dateFilter}
                />
                {dateFilter && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => { setDateFilter(undefined); resetPages(); }}
                    >
                      Xóa lọc ngày
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Status filter */}
            <Select value={activeTab} onValueChange={handleTabChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((tab) => {
                  const count =
                    tab.value === "0" ? counts.all
                    : tab.value === "2" ? counts.ongoing
                    : tab.value === "1" ? counts.upcoming
                    : tab.value === "scheduled" ? counts.scheduled
                    : counts.expired;
                  return (
                    <SelectItem key={tab.value} value={tab.value}>
                      {tab.label}{count > 0 ? ` (${count})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetchingAny}
              className="bg-brand/10 border-brand/20 hover:bg-brand/20 text-brand"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isFetchingAny && "animate-spin")} />
              {isFetchingAny ? "Đang tải..." : "Làm mới"}
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ==================== SCHEDULED TAB (Auto History) ==================== */}
          {isScheduledTab ? (
            <>
              {/* Mobile - Scheduled */}
              <div className="md:hidden">
                {autoLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
                ) : filteredAutoHistory.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Chưa có Flash Sale nào được lên lịch.</div>
                ) : (
                  <div className="divide-y">
                    {mobileAutoData.map((record) => {
                      const cfg = AUTO_STATUS_CONFIG[record.status] || AUTO_STATUS_CONFIG.pending;
                      return (
                        <div key={record.id} className="p-4 bg-card">
                          <div className="text-xs font-medium text-brand mb-1.5">
                            {shopNameMap.get(record.shop_id) || `Shop #${record.shop_id}`}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                              {formatDate(record.slot_start_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              {formatTime(record.slot_start_time)} – {formatTime(record.slot_end_time)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                            <span className="text-xs text-muted-foreground">{formatLeadTime(record.lead_time_minutes)}</span>
                            {record.scheduled_at && (
                              <span className="text-xs text-info ml-auto">
                                Chờ đến {formatISODateTime(record.scheduled_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Desktop - Scheduled */}
              <div className="hidden md:block">
                {autoLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
                ) : filteredAutoHistory.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Chưa có Flash Sale nào được lên lịch.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Shop</TableHead>
                        <TableHead className="w-[260px]">Khung giờ</TableHead>
                        <TableHead className="w-[120px]">Trạng thái</TableHead>
                        <TableHead>Ghi chú</TableHead>
                        <TableHead className="w-[100px]">Cài trước</TableHead>
                        <TableHead className="w-[160px]">Đặt lịch lúc</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {desktopAutoData.map((record) => {
                        const cfg = AUTO_STATUS_CONFIG[record.status] || AUTO_STATUS_CONFIG.pending;
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <span className="text-sm font-medium text-foreground truncate block max-w-[160px]">
                                {shopNameMap.get(record.shop_id) || `Shop #${record.shop_id}`}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>
                                {formatTime(record.slot_start_time)}{" "}
                                {formatDate(record.slot_start_time)} –{" "}
                                {formatTime(record.slot_end_time)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cfg.color}>
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {cfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {record.scheduled_at && (
                                <span className="text-xs text-info">
                                  Chờ đến {formatISODateTime(record.scheduled_at)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {formatLeadTime(record.lead_time_minutes)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {formatISODateTime(record.created_at)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Pagination for scheduled tab */}
              {desktopTotalPages > 1 && (
                <div className="border-t px-4 py-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => { setDesktopPage((p) => Math.max(1, p - 1)); setMobilePage((p) => Math.max(1, p - 1)); }}
                          className={cn("cursor-pointer", desktopPage === 1 && "pointer-events-none opacity-50")}
                        />
                      </PaginationItem>
                      {getPageNumbers(desktopPage, desktopTotalPages).map((p, i) => (
                        <PaginationItem key={i}>
                          {p === "ellipsis" ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              isActive={desktopPage === p}
                              onClick={() => { setDesktopPage(p as number); setMobilePage(p as number); }}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => { setDesktopPage((p) => Math.min(desktopTotalPages, p + 1)); setMobilePage((p) => Math.min(mobileTotalPages, p + 1)); }}
                          className={cn("cursor-pointer", desktopPage === desktopTotalPages && "pointer-events-none opacity-50")}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ==================== FLASH SALE TABS ==================== */}
              {/* Mobile List */}
              <div className="md:hidden">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
                ) : filteredData.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {counts.all === 0
                      ? "Chưa có Flash Sale nào."
                      : "Không có Flash Sale nào phù hợp."}
                  </div>
                ) : (
                  <div className="divide-y">
                    {mobileData.map((sale) => {
                      const startDate = new Date(sale.start_time * 1000);
                      const endDate = new Date(sale.end_time * 1000);
                      const dateStr = startDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
                      const startTimeStr = startDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                      const endTimeStr = endDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

                      return (
                        <div
                          key={`${sale.shop_id}-${sale.flash_sale_id}`}
                          className="p-4 bg-card cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => setDetailFlashSale(sale)}
                        >
                          <div className="text-xs font-medium text-brand mb-1.5">
                            {shopNameMap.get(sale.shop_id) || `Shop #${sale.shop_id}`}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3 text-sm text-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                {dateStr}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                {startTimeStr} - {endTimeStr}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                sale.type === 2
                                  ? "bg-success/10 text-success"
                                  : sale.type === 1
                                    ? "bg-info/10 text-info"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {sale.type === 2 ? "Đang chạy" : sale.type === 1 ? "Sắp tới" : "Kết thúc"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">#{sale.flash_sale_id}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              <span className={cn("font-medium", sale.enabled_item_count > 0 ? "text-brand" : "text-muted-foreground")}>
                                {sale.enabled_item_count}
                              </span>
                              <span className="text-muted-foreground">/{sale.item_count} SP</span>
                            </span>
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
                                onClick={() => setMobilePage((p) => Math.max(1, p - 1))}
                                className={cn("cursor-pointer", mobilePage === 1 && "pointer-events-none opacity-50")}
                              />
                            </PaginationItem>
                            {getPageNumbers(mobilePage, mobileTotalPages).map((p, i) => (
                              <PaginationItem key={i}>
                                {p === "ellipsis" ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    isActive={mobilePage === p}
                                    onClick={() => setMobilePage(p as number)}
                                    className="cursor-pointer"
                                  >
                                    {p}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setMobilePage((p) => Math.min(mobileTotalPages, p + 1))}
                                className={cn("cursor-pointer", mobilePage === mobileTotalPages && "pointer-events-none opacity-50")}
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
                  <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
                ) : filteredData.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {counts.all === 0
                      ? "Chưa có Flash Sale nào."
                      : "Không có Flash Sale nào phù hợp với bộ lọc."}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Shop</TableHead>
                          <TableHead className="w-[280px]">Khung giờ</TableHead>
                          <TableHead className="w-[140px]">Trạng thái</TableHead>
                          <TableHead className="w-[120px] text-center">Số lượng SP</TableHead>
                          <TableHead className="w-[80px] text-center">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {desktopData.map((sale) => {
                          const sameDay = formatDate(sale.start_time) === formatDate(sale.end_time);
                          const typeConfig = {
                            2: { label: "Đang chạy", color: "bg-success/10 text-success border-success", dot: "bg-success", pulse: true },
                            1: { label: "Sắp tới", color: "bg-info/10 text-info border-info", dot: "bg-info", pulse: false },
                            3: { label: "Kết thúc", color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", pulse: false },
                          }[sale.type] || { label: "Không rõ", color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", pulse: false };

                          return (
                            <TableRow
                              key={`${sale.shop_id}-${sale.flash_sale_id}`}
                              className="cursor-pointer hover:bg-accent transition-colors"
                              onClick={() => setDetailFlashSale(sale)}
                            >
                              <TableCell>
                                <span className="text-sm font-medium text-foreground truncate block max-w-[160px]">
                                  {shopNameMap.get(sale.shop_id) || `Shop #${sale.shop_id}`}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div>
                                  {formatTime(sale.start_time)}{" "}
                                  {formatDate(sale.start_time)} –{" "}
                                  {sameDay ? formatTime(sale.end_time) : formatDateTime(sale.end_time)}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                  #{sale.flash_sale_id}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={typeConfig.color}>
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
                              <TableCell className="text-center">
                                <span className={cn(sale.enabled_item_count > 0 ? "text-brand" : "")}>
                                  {sale.enabled_item_count}
                                </span>
                                <span className="text-muted-foreground">/{sale.item_count}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-muted-foreground hover:text-info cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailFlashSale(sale);
                                          }}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Xem chi tiết</TooltipContent>
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
                                onClick={() => setDesktopPage((p) => Math.max(1, p - 1))}
                                className={cn("cursor-pointer", desktopPage === 1 && "pointer-events-none opacity-50")}
                              />
                            </PaginationItem>
                            {getPageNumbers(desktopPage, desktopTotalPages).map((p, i) => (
                              <PaginationItem key={i}>
                                {p === "ellipsis" ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    isActive={desktopPage === p}
                                    onClick={() => setDesktopPage(p as number)}
                                    className="cursor-pointer"
                                  >
                                    {p}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setDesktopPage((p) => Math.min(desktopTotalPages, p + 1))}
                                className={cn("cursor-pointer", desktopPage === desktopTotalPages && "pointer-events-none opacity-50")}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Last update info */}
          {dataUpdatedAt > 0 && (
            <div className="px-4 py-2 border-t bg-muted text-xs text-muted-foreground">
              Cập nhật: {formatDateTime(dataUpdatedAt / 1000)}
            </div>
          )}
        </div>
      </CardContent>

      {/* Detail Modal */}
      <Dialog
        open={!!detailFlashSale}
        onOpenChange={(open) => !open && setDetailFlashSale(null)}
      >
        <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden">
          {detailFlashSale && (
            <FlashSaleDetailPanel
              shopId={detailFlashSale.shop_id}
              flashSale={detailFlashSale}
              onBack={() => setDetailFlashSale(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default AllShopsFlashSalePanel;
