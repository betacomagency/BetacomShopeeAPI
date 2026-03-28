/**
 * AdminDashboardPanel - Tổng quan nhanh với link đến detail pages
 * Compact overview: System Status, API Stats, Business Stats, Recent Push Events
 * Chi tiết nằm trong Monitoring sub-pages
 */

import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Heart,
  Store,
  Bell,
  Zap,
  BarChart3,
  Server,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSystemHealth } from "@/hooks/monitoring/use-system-health";
import { useBusinessMetrics } from "@/hooks/monitoring/use-business-metrics";
import { useApiAnalytics } from "@/hooks/monitoring/use-api-analytics";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ==================== HELPERS ====================

const PUSH_TYPE_LABELS: Record<number, string> = {
  1: "Auth", 2: "Deauth", 5: "Updates", 12: "Token Expiry", 28: "Penalty",
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ==================== SUB-COMPONENTS ====================

/** Compact stat with link */
function QuickStat({ label, value, sub, icon: Icon, linkTo, variant }: {
  label: string; value: string | number; sub?: string;
  icon: typeof Activity; linkTo: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const borderColor = variant === 'danger' ? 'border-destructive/30' : variant === 'warning' ? 'border-warning/30' : variant === 'success' ? 'border-success/30' : '';
  return (
    <Link to={linkTo} className="cursor-pointer">
      <Card className={cn("hover:shadow-md transition-shadow", borderColor)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className={cn("text-2xl font-bold mt-1", variant === 'danger' && 'text-destructive', variant === 'success' && 'text-success')}>{value}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

// ==================== MAIN COMPONENT ====================

export function AdminDashboardPanel({ userId: _userId }: { userId: string }) {
  const { data: health } = useSystemHealth();
  const { data: business } = useBusinessMetrics();
  const { data: api } = useApiAnalytics(24);

  // Push Events (unique to Tổng quan)
  const { data: recentPush, isLoading: pushLoading } = useQuery({
    queryKey: ["admin-recent-push"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apishopee_push_logs")
        .select("id, push_code, push_type, shop_id, processed, process_result, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Shop name map
  const { data: shopNames } = useQuery({
    queryKey: ["admin-shop-names"],
    queryFn: async () => {
      const { data } = await supabase.from("apishopee_shops").select("shop_id, shop_name");
      const map = new Map<number, string>();
      (data || []).forEach((s) => map.set(s.shop_id, s.shop_name || `Shop #${s.shop_id}`));
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Derived values
  const workerStatus = health?.worker?.is_stale ? 'down' : (health?.worker?.status ?? 'unknown');
  const errorRate = api?.summary.error_rate ?? 0;
  const totalCalls = api?.summary.total_calls ?? 0;
  const totalErrors = (api?.summary.failed ?? 0) + (api?.summary.timeout ?? 0);
  const tokenExpired = health?.tokens.expired ?? 0;
  const tokenTotal = health?.tokens.total ?? 0;
  const flashSaleSuccess = business?.flash_sales.success_rate ?? 0;
  const jobsPending = (business?.jobs_queue.scheduled ?? 0) + (business?.jobs_queue.processing ?? 0) + (business?.jobs_queue.retry ?? 0);

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-[calc(100vh-73px)]">

      {/* Row 1: System Status — 4 cards linking to monitoring sub-pages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Heart className="h-4 w-4" /> Trạng thái hệ thống
          </h2>
          <Link to="/admin/monitoring" className="text-xs text-info flex items-center gap-1 cursor-pointer">
            Chi tiết <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickStat
            label="Worker" value={workerStatus.toUpperCase()} icon={Server}
            linkTo="/admin/monitoring"
            variant={workerStatus === 'healthy' ? 'success' : workerStatus === 'degraded' ? 'warning' : 'danger'}
          />
          <QuickStat
            label="Token" value={`${tokenTotal - tokenExpired} / ${tokenTotal}`}
            sub={tokenExpired > 0 ? `${tokenExpired} hết hạn` : 'Tất cả OK'}
            icon={CheckCircle2} linkTo="/admin/monitoring"
            variant={tokenExpired > 0 ? 'danger' : 'success'}
          />
          <QuickStat
            label="Flash Sale (7d)" value={`${flashSaleSuccess}%`}
            sub={`${business?.flash_sales.week.success ?? 0} / ${business?.flash_sales.week.total ?? 0} jobs`}
            icon={Zap} linkTo="/admin/monitoring/business"
            variant={flashSaleSuccess < 90 ? 'danger' : flashSaleSuccess < 95 ? 'warning' : 'success'}
          />
          <QuickStat
            label="Job Queue" value={jobsPending}
            sub={`${business?.jobs_queue.success_today ?? 0} done today`}
            icon={Clock} linkTo="/admin/monitoring/business"
            variant={jobsPending > 50 ? 'warning' : 'default'}
          />
        </div>
      </div>

      {/* Row 2: API Overview — compact with link */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> API (24h)
          </h2>
          <Link to="/admin/monitoring/api" className="text-xs text-info flex items-center gap-1 cursor-pointer">
            Chi tiết <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickStat label="Tổng calls" value={totalCalls.toLocaleString()} icon={Activity} linkTo="/admin/monitoring/api" />
          <QuickStat
            label="Lỗi" value={totalErrors} icon={AlertTriangle} linkTo="/admin/monitoring/api"
            variant={totalErrors > 100 ? 'danger' : totalErrors > 0 ? 'warning' : 'success'}
          />
          <QuickStat
            label="Thành công" value={`${(100 - errorRate).toFixed(1)}%`} icon={CheckCircle2} linkTo="/admin/monitoring/api"
            variant={errorRate > 5 ? 'danger' : errorRate > 1 ? 'warning' : 'success'}
          />
          <QuickStat
            label="Latency TB" value={`${api?.summary.avg_duration_ms ?? 0}ms`}
            sub={`p95: ${api?.summary.p95_duration_ms ?? 0}ms`}
            icon={Clock} linkTo="/admin/monitoring/api"
          />
        </div>
      </div>

      {/* Row 3: Shops + Top Errors side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shops quick summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Store className="h-4 w-4" /> Shops ({business?.shops.total ?? 0})
            </h2>
            <Link to="/admin/shops" className="text-xs text-info flex items-center gap-1 cursor-pointer">
              Quản lý <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-success">{business?.shops.active ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-destructive">{business?.shops.inactive ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Inactive</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{business?.shops.total ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top 5 errors */}
          {api && api.top_errors.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground">Top Errors (24h)</h3>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {api.top_errors.slice(0, 5).map((err, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Badge variant="destructive" className="text-[10px]">{err.error}</Badge>
                          <span className="ml-2 text-xs text-muted-foreground truncate">{err.message}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold">{err.count}</span>
                          <span className="text-[10px] text-muted-foreground">{err.edge_function}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Push Events */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" /> Push Events gần đây
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              {pushLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Đang tải...</div>
              ) : !recentPush || recentPush.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Chưa có push event</div>
              ) : (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {recentPush.map((push) => (
                    <div key={push.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-info/10 text-info border-info">
                            {PUSH_TYPE_LABELS[push.push_code] || `Code ${push.push_code}`}
                          </Badge>
                          <span className="text-sm text-muted-foreground truncate">
                            {push.shop_id ? shopNames?.get(push.shop_id) || `Shop #${push.shop_id}` : "System"}
                          </span>
                        </div>
                        {push.process_result && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{push.process_result}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {push.processed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatTime(push.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPanel;
