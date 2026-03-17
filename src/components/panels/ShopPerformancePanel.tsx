/**
 * ShopPerformancePanel
 * Hiển thị Hiệu quả bán hàng từ v2.account_health.get_shop_performance
 * Tab 1: Tổng quan (overall rating + metric list theo category)
 * Tab 2: Chi tiết Metrics (affected orders/listings per metric)
 */

import { useEffect, useState } from 'react';
import { useShopPerformance } from '@/hooks/useShopPerformance';
import { useShopeeAuth } from '@/contexts/ShopeeAuthContext';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ShopPerformanceMetricRow } from '@/lib/shopee/types';

// ─── Constants ──────────────────────────────────────────────────────────────


const METRIC_TYPE_LABELS: Record<number, string> = {
  1: 'Quản lý Đơn hàng',
  2: 'Vi phạm Đăng bán',
  3: 'Chăm sóc Khách hàng',
};

// Map metric_id → tên tiếng Việt theo Shopee Seller Center
const METRIC_ID_LABELS: Record<number, string> = {
  // Nhóm ảo (metric_id < 0)
  [-1]: 'Chat chưa trả lời',
  // Quản lý Đơn hàng
  1:    'Tỷ lệ giao hàng trễ (Tất cả kênh)',
  3:    'Tỷ lệ đơn hàng không thành công (Tất cả kênh)',
  4:    'Thời gian chuẩn bị hàng',
  25:   'Tỷ lệ bàn giao nhanh',
  27:   'Tỷ lệ lấy hàng đúng giờ thất bại',
  28:   'Giá trị vi phạm OPFR',
  29:   'Thời gian phản hồi trung bình',
  42:   'Tỷ lệ hủy đơn (Tất cả kênh)',
  43:   'Tỷ lệ trả hàng/hoàn tiền (Tất cả kênh)',
  85:   'Tỷ lệ giao hàng trễ (NDD)',
  88:   'Tỷ lệ đơn hàng không thành công (NDD)',
  91:   'Tỷ lệ hủy đơn (NDD)',
  92:   'Tỷ lệ trả hàng/hoàn tiền (NDD)',
  2001: 'Tỷ lệ bàn giao nhanh - SLS',
  2002: 'Tỷ lệ bàn giao nhanh - FBS',
  2003: 'Tỷ lệ bàn giao nhanh - 3PF',
  2032: 'Giao hàng thứ Bảy',
  2033: 'Thời gian chuẩn bị hàng PS',
  // Vi phạm Đăng bán
  12:   'Hàng đặt trước (%)',
  15:   'Số ngày vi phạm hàng đặt trước',
  52:   'Sản phẩm bị khóa/xóa (nghiêm trọng)',
  53:   'Các vi phạm đăng bán khác',
  54:   'Sản phẩm cấm',
  55:   'Hàng giả/Vi phạm sở hữu trí tuệ',
  56:   'Sản phẩm trùng lặp',
  95:   'Mức độ hài lòng khách hàng',
  96:   'Tỷ lệ listing SDD (%)',
  97:   'Tỷ lệ listing NDD (%)',
  2011: 'Sản phẩm có đánh giá chất lượng tiêu cực',
  2030: 'Tỷ lệ listing HD (%)',
  2031: 'Tỷ lệ HD freeship được bật (%)',
  // Chăm sóc Khách hàng
  11:   'Tỷ lệ phản hồi chat',
  21:   'Thời gian phản hồi',
  22:   'Đánh giá Shop',
  23:   'Số chat chưa trả lời',
};

// Dùng fallback nếu không có trong map
function getMetricLabel(metricId: number | null, metricName: string | null): string {
  if (metricId !== null && METRIC_ID_LABELS[metricId]) return METRIC_ID_LABELS[metricId];
  return metricName || '-';
}


// ─── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number | null, unit: number | null): string {
  if (value === null || value === undefined) return '-';
  const u = unit ?? 1;
  if (u === 2) return `${value.toFixed(2)}%`;
  if (u === 3) return `${value.toFixed(0)}s`;
  if (u === 4) return `${value} ngày`;
  if (u === 5) return `${value} giờ`;
  return value.toFixed(2);
}


function isMetricFailed(m: ShopPerformanceMetricRow): boolean {
  if (m.current_period === null || m.target_value === null || !m.target_comparator) return false;
  const c = m.current_period;
  const t = m.target_value;
  switch (m.target_comparator) {
    case '<': return c >= t;
    case '<=': return c > t;
    case '>': return c <= t;
    case '>=': return c < t;
    case '=': return c !== t;
    default: return false;
  }
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ m }: { m: ShopPerformanceMetricRow }) {
  const failed = isMetricFailed(m);

  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1.5 ${failed ? 'border-destructive/20 bg-destructive/10' : 'border-border bg-card'}`}>
      <div className="text-xs text-muted-foreground leading-tight min-h-[2.5rem] flex items-start">
        <span>{getMetricLabel(m.metric_id, m.metric_name)}</span>
      </div>
      {m.exemption_end_date && (
        <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded self-start">Miễn trừ đến {m.exemption_end_date}</span>
      )}
      <div className={`text-lg font-semibold ${failed ? 'text-destructive' : 'text-foreground'}`}>
        {formatValue(m.current_period, m.unit)}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-1.5 mt-auto">
        <span>Kỳ trước: <span className="text-foreground">{formatValue(m.last_period, m.unit)}</span></span>
        {m.target_comparator && m.target_value !== null && (
          <span>Mục tiêu: <span className="text-foreground">{m.target_comparator} {formatValue(m.target_value, m.unit)}</span></span>
        )}
      </div>
    </div>
  );
}

// ─── Category Section ────────────────────────────────────────────────────────

function CategorySection({ title, metricType, metrics }: { title: string; metricType: number; metrics: ShopPerformanceMetricRow[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const categoryMetrics = metrics.filter(m => m.metric_type === metricType);
  if (!categoryMetrics.length) return null;

  const failedCount = categoryMetrics.filter(m => (m.metric_id ?? 0) >= 0 && isMetricFailed(m)).length;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">{title}</span>
          {failedCount > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
              {failedCount} không đạt
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {categoryMetrics.map(m => <MetricCard key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab({ metrics }: {
  metrics: ShopPerformanceMetricRow[];
}) {
  return (
    <div className="space-y-4">

      {/* Metric Categories */}
      <CategorySection title={METRIC_TYPE_LABELS[1]} metricType={1} metrics={metrics} />
      <CategorySection title={METRIC_TYPE_LABELS[2]} metricType={2} metrics={metrics} />
      <CategorySection title={METRIC_TYPE_LABELS[3]} metricType={3} metrics={metrics} />
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function ShopPerformancePanel() {
  const { selectedShopId: shopId, shops } = useShopeeAuth();
  const { isAdmin } = usePermissionsContext();

  const {
    metrics,
    hasSyncedData,
    isSyncing,
    isLoadingMetrics,
    syncError,
    syncAllProgress,
    syncPerformance,
    syncAllShops,
    loadLatestFromDB,
  } = useShopPerformance(shopId ?? 0);

  const shopIdNum = shopId ?? 0;

  // Load from DB on mount / shop change
  useEffect(() => {
    if (shopId) loadLatestFromDB();
  }, [shopId, loadLatestFromDB]);

  if (!shopIdNum) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <p>Vui lòng chọn shop để xem hiệu quả bán hàng</p>
      </div>
    );
  }

  const isLoading = isLoadingMetrics;
  const activeShops = shops.filter(s => s.is_active);
  const p = syncAllProgress;
  const syncAllInProgress = p !== null && p.done < p.total;
  const syncAllDone = p !== null && p.done === p.total && p.total > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-end gap-2">
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncAllShops(activeShops)}
            disabled={isSyncing}
            className="cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncAllInProgress ? 'animate-spin' : ''}`} />
            Đồng bộ tất cả ({activeShops.length})
          </Button>
        )}
        <Button
          size="sm"
          onClick={syncPerformance}
          disabled={isSyncing}
          className="cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing && !p ? 'animate-spin' : ''}`} />
          {isSyncing && !p ? 'Đang đồng bộ...' : 'Đồng bộ'}
        </Button>
      </div>

      {/* Sync All Progress */}
      {syncAllInProgress && p && (
        <div className="p-3 bg-info/10 border border-info/20 rounded-lg space-y-2">
          <div className="flex justify-between text-sm text-info">
            <span>Đang đồng bộ: <strong>{p.current}</strong></span>
            <span>{p.done}/{p.total}</span>
          </div>
          <Progress value={(p.done / p.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Sync All Done */}
      {syncAllDone && p && (
        <div className={`p-3 border rounded-lg text-sm ${p.errors.length > 0 ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-success/10 border-success/20 text-success'}`}>
          {p.errors.length === 0
            ? `Đồng bộ thành công ${p.total} shop`
            : (
              <div className="space-y-1">
                <p>Hoàn thành: {p.total - p.errors.length}/{p.total} shop thành công</p>
                {p.errors.map(e => (
                  <p key={e.shopId} className="text-xs text-destructive">
                    {e.rateLimited ? '⏱' : '•'} {e.shopName}: {e.message}
                    {e.rateLimited && <span className="ml-1 font-semibold text-brand">[Rate limit]</span>}
                  </p>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Error */}
      {syncError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {syncError}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          <div className="h-20 bg-muted rounded-lg animate-pulse" />
          <div className="h-48 bg-muted rounded-lg animate-pulse" />
        </div>
      )}

      {/* No data */}
      {!isLoading && !hasSyncedData && !syncError && (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <TrendingUp className="w-10 h-10 mb-3 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Chưa có dữ liệu</p>
          <p className="text-sm mt-1">Nhấn "Đồng bộ" để lấy dữ liệu hiệu quả bán hàng từ Shopee</p>
        </div>
      )}

      {hasSyncedData && !isLoading && (
        <OverviewTab metrics={metrics} />
      )}
    </div>
  );
}
