/**
 * ActivityLogsPanel - Bảng lịch sử thao tác hệ thống (admin only)
 */

import { useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActivityLogs, fetchActivityLogDetail } from "@/hooks/useActivityLogs";
import type { ActivityLog } from "@/hooks/useActivityLogs";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const CATEGORY_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "flash_sale", label: "Flash Sale" },
  { value: "reviews", label: "Đánh giá" },
  { value: "products", label: "Sản phẩm" },
  { value: "auth", label: "Xác thực" },
  { value: "system", label: "Hệ thống" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "success", label: "Thành công" },
  { value: "failed", label: "Lỗi" },
  { value: "pending", label: "Đang xử lý" },
  { value: "cancelled", label: "Hủy" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "manual", label: "Thủ công" },
  { value: "scheduled", label: "Lên lịch" },
  { value: "auto", label: "Tự động" },
  { value: "webhook", label: "Webhook" },
  { value: "api", label: "API" },
];

const DATE_OPTIONS = [
  { value: "1h", label: "1 giờ" },
  { value: "24h", label: "24 giờ" },
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" },
];

const CATEGORY_COLORS: Record<string, string> = {
  flash_sale: "bg-orange-50 text-orange-700 border-orange-200",
  auth: "bg-purple-50 text-purple-700 border-purple-200",
  products: "bg-blue-50 text-blue-700 border-blue-200",
  reviews: "bg-cyan-50 text-cyan-700 border-cyan-200",
  system: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ==================== COMPONENT ====================

export function ActivityLogsPanel() {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [dateRange, setDateRange] = useState<"1h" | "24h" | "7d" | "30d" | "all">("7d");
  const [page, setPage] = useState(0);
  const [detailLog, setDetailLog] = useState<ActivityLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data, isLoading, isFetching, refetch } = useActivityLogs({
    category,
    status,
    source,
    dateRange,
    page,
    pageSize: PAGE_SIZE,
  });

  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  const handleViewDetail = async (logId: string) => {
    setDetailLoading(true);
    const detail = await fetchActivityLogDetail(logId);
    setDetailLog(detail);
    setDetailLoading(false);
  };

  return (
    <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
      <CardContent className="p-0 flex flex-col h-full overflow-hidden">
        {/* Filter Bar */}
        <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={category} onValueChange={handleFilterChange(setCategory)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={handleFilterChange(setStatus)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={source} onValueChange={handleFilterChange(setSource)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={handleFilterChange(setDateRange as (v: string) => void)}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {totalCount.toLocaleString()} kết quả
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
              Làm mới
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Không có dữ liệu</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Thời gian</TableHead>
                      <TableHead className="w-[120px]">User</TableHead>
                      <TableHead>Thao tác</TableHead>
                      <TableHead className="w-[130px]">Shop</TableHead>
                      <TableHead className="w-[90px]">Loại</TableHead>
                      <TableHead className="w-[90px]">Trạng thái</TableHead>
                      <TableHead className="w-[80px] text-right">Thời lượng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                        onClick={() => handleViewDetail(log.id)}
                      >
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[120px]">
                          {log.user_name || log.user_email || "System"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700 line-clamp-1">{log.action_description}</div>
                          {log.error_message && (
                            <div className="text-[10px] text-red-500 line-clamp-1 mt-0.5">{log.error_message}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 truncate max-w-[130px]">
                          {log.shop_name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[log.action_category] || CATEGORY_COLORS.system)}>
                            {log.action_category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[log.status] || STATUS_COLORS.pending)}>
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {log.duration_ms != null ? `${log.duration_ms}ms` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => handleViewDetail(log.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm text-slate-700 line-clamp-2">{log.action_description}</div>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", STATUS_COLORS[log.status] || STATUS_COLORS.pending)}>
                        {log.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[log.action_category] || CATEGORY_COLORS.system)}>
                        {log.action_category}
                      </Badge>
                      {log.shop_name && <span className="text-[10px] text-slate-400">{log.shop_name}</span>}
                      <span className="text-[10px] text-slate-400 ml-auto">{formatDateTime(log.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 border-t px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Trang {page + 1}/{totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="p-8 text-center text-slate-500">Đang tải...</div>
          ) : detailLog ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{detailLog.action_description}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">User</span>
                    <div>{detailLog.user_name || detailLog.user_email || "System"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Shop</span>
                    <div>{detailLog.shop_name || "-"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Loại</span>
                    <div>
                      <Badge variant="outline" className={cn("text-xs", CATEGORY_COLORS[detailLog.action_category] || CATEGORY_COLORS.system)}>
                        {detailLog.action_category}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Trạng thái</span>
                    <div>
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[detailLog.status] || STATUS_COLORS.pending)}>
                        {detailLog.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Thời gian</span>
                    <div className="font-mono text-xs">{formatDateTime(detailLog.created_at)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Thời lượng</span>
                    <div>{detailLog.duration_ms != null ? `${detailLog.duration_ms}ms` : "-"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nguồn</span>
                    <div>{detailLog.source || "-"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Action Type</span>
                    <div className="font-mono text-xs">{detailLog.action_type}</div>
                  </div>
                </div>

                {detailLog.error_message && (
                  <div>
                    <span className="text-muted-foreground text-xs">Lỗi</span>
                    <div className="text-sm text-red-600 bg-red-50 rounded p-2 mt-1 font-mono text-xs whitespace-pre-wrap">
                      {detailLog.error_message}
                    </div>
                  </div>
                )}

                {detailLog.target_type && (
                  <div>
                    <span className="text-muted-foreground text-xs">Target</span>
                    <div className="text-sm">
                      {detailLog.target_type}
                      {detailLog.target_id ? ` #${detailLog.target_id}` : ""}
                      {detailLog.target_name ? ` (${detailLog.target_name})` : ""}
                    </div>
                  </div>
                )}

                {detailLog.request_data && Object.keys(detailLog.request_data).length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Request Data</span>
                    <pre className="text-xs bg-slate-50 rounded p-2 mt-1 overflow-x-auto max-h-[200px]">
                      {JSON.stringify(detailLog.request_data, null, 2)}
                    </pre>
                  </div>
                )}

                {detailLog.response_data && Object.keys(detailLog.response_data).length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Response Data</span>
                    <pre className="text-xs bg-slate-50 rounded p-2 mt-1 overflow-x-auto max-h-[200px]">
                      {JSON.stringify(detailLog.response_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ActivityLogsPanel;
