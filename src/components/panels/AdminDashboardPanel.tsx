/**
 * AdminDashboardPanel - Tổng quan hệ thống cho admin
 * 4 sections: API Stats, Shop Health, Recent Activity, Recent Push Events
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Store,
  Bell,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useApiCallStats } from "@/hooks/useApiCallStats";
import { useShopeeAuth } from "@/hooks/useShopeeAuth";
import { cn } from "@/lib/utils";

interface AdminDashboardPanelProps {
  userId: string;
}

// ==================== HELPERS ====================

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTokenStatus(expiredAt: number | null): {
  label: string;
  color: string;
  icon: typeof CheckCircle2;
} {
  if (!expiredAt) return { label: "Chưa có token", color: "text-muted-foreground", icon: XCircle };

  const now = Date.now() / 1000;
  const hoursLeft = (expiredAt - now) / 3600;

  if (hoursLeft <= 0) return { label: "Hết hạn", color: "text-destructive", icon: XCircle };
  if (hoursLeft < 1) return { label: `${Math.round(hoursLeft * 60)}p`, color: "text-destructive", icon: AlertTriangle };
  if (hoursLeft < 24) return { label: `${Math.round(hoursLeft)}h`, color: "text-warning", icon: AlertTriangle };
  return { label: "OK", color: "text-success", icon: CheckCircle2 };
}

const CATEGORY_COLORS: Record<string, string> = {
  flash_sale: "bg-brand/10 text-brand border-brand",
  auth: "bg-info/10 text-info border-info",
  products: "bg-info/10 text-info border-info",
  reviews: "bg-info/10 text-info border-info",
  system: "bg-muted text-muted-foreground border-border",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-success/10 text-success border-success",
  failed: "bg-destructive/10 text-destructive border-destructive",
  pending: "bg-warning/10 text-warning border-warning",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const PUSH_TYPE_LABELS: Record<number, string> = {
  1: "Auth",
  2: "Deauth",
  5: "Updates",
  12: "Token Expiry",
  28: "Penalty",
};

// ==================== COMPONENT ====================

export function AdminDashboardPanel({ userId: _userId }: AdminDashboardPanelProps) {
  const { shops: _shops } = useShopeeAuth();

  // Section 1: API Stats (24h)
  const { data: statsData, isLoading: statsLoading } = useApiCallStats({ dateRange: "24h" });

  // Section 2: Shop Health - query token expiry
  const { data: shopTokens } = useQuery({
    queryKey: ["admin-shop-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apishopee_shops")
        .select("shop_id, shop_name, shop_logo, expired_at, token_updated_at, region")
        .order("shop_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Section 3: Recent Activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_activity_logs")
        .select("id, user_name, user_email, shop_name, action_type, action_category, action_description, status, source, duration_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Section 4: Recent Push Events
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
    refetchOnWindowFocus: false,
  });

  // Shop name map for push logs
  const shopNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (shopTokens || []).forEach((s) => map.set(s.shop_id, s.shop_name || `Shop #${s.shop_id}`));
    return map;
  }, [shopTokens]);

  // Shop health summary
  const shopHealth = useMemo(() => {
    if (!shopTokens) return { total: 0, healthy: 0, expiring: 0, expired: 0 };
    const now = Date.now() / 1000;
    let healthy = 0, expiring = 0, expired = 0;
    shopTokens.forEach((s) => {
      if (!s.expired_at) { expired++; return; }
      const hoursLeft = (s.expired_at - now) / 3600;
      if (hoursLeft <= 0) expired++;
      else if (hoursLeft < 24) expiring++;
      else healthy++;
    });
    return { total: shopTokens.length, healthy, expiring, expired };
  }, [shopTokens]);

  // Sort shops: expired first, then expiring, then healthy
  const sortedShops = useMemo(() => {
    if (!shopTokens) return [];
    const now = Date.now() / 1000;
    return [...shopTokens].sort((a, b) => {
      const getPriority = (s: typeof a) => {
        if (!s.expired_at) return 0;
        const h = (s.expired_at - now) / 3600;
        if (h <= 0) return 0;
        if (h < 24) return 1;
        return 2;
      };
      return getPriority(a) - getPriority(b);
    });
  }, [shopTokens]);

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-[calc(100vh-73px)]">
      {/* Section 1: API Stats Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            API Overview (24h)
          </h2>
          <Link
            to="/admin/api-logs"
            className="text-xs text-info hover:text-info flex items-center gap-1 cursor-pointer"
          >
            Xem chi tiết <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Tổng API calls</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {statsLoading ? "..." : (statsData?.summary.total ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Lỗi</div>
              <div className={cn("text-2xl font-bold mt-1", (statsData?.summary.failed || 0) > 0 ? "text-destructive" : "text-foreground")}>
                {statsLoading ? "..." : statsData?.summary.failed ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Tỷ lệ thành công</div>
              <div className={cn("text-2xl font-bold mt-1", (statsData?.summary.successRate || 0) >= 95 ? "text-success" : (statsData?.summary.successRate || 0) >= 80 ? "text-warning" : "text-destructive")}>
                {statsLoading ? "..." : `${(statsData?.summary.successRate ?? 0).toFixed(1)}%`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Thời gian TB</div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {statsLoading ? "..." : `${statsData?.summary.avgDuration ?? 0}ms`}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Shop Health */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Store className="h-4 w-4" />
            Sức khỏe Shop ({shopHealth.total})
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-success">{shopHealth.healthy} OK</span>
            {shopHealth.expiring > 0 ? <span className="text-warning">{shopHealth.expiring} sắp hết hạn</span> : null}
            {shopHealth.expired > 0 ? <span className="text-destructive">{shopHealth.expired} hết hạn</span> : null}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedShops.map((shop) => {
            const tokenStatus = getTokenStatus(shop.expired_at);
            const StatusIcon = tokenStatus.icon;
            const isExpired = tokenStatus.label === 'Hết hạn' || tokenStatus.label === 'Chưa có token';
            const isExpiring = !isExpired && tokenStatus.icon === AlertTriangle;
            return (
              <Card key={shop.shop_id} className={cn(
                "hover:shadow-sm transition-shadow",
                isExpired && "border-destructive bg-destructive/10",
                isExpiring && "border-warning bg-warning/10",
              )}>
                <CardContent className="p-3 flex items-center gap-3">
                  {shop.shop_logo ? (
                    <img
                      src={shop.shop_logo}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Store className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {shop.shop_name || `Shop #${shop.shop_id}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {shop.region?.toUpperCase()}
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1 text-xs font-medium flex-shrink-0", tokenStatus.color)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {tokenStatus.label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Section 3 & 4: Activity Feed + Push Events side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 3: Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Hoạt động gần đây
            </h2>
          </div>

          <Card>
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Đang tải...</div>
              ) : !recentActivity || recentActivity.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Chưa có hoạt động nào</div>
              ) : (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {recentActivity.map((log) => (
                    <div key={log.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-foreground line-clamp-1">
                            {log.action_description}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CATEGORY_COLORS[log.action_category] || CATEGORY_COLORS.system)}>
                              {log.action_category}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[log.status] || STATUS_COLORS.pending)}>
                              {log.status}
                            </Badge>
                            {log.shop_name && (
                              <span className="text-[10px] text-muted-foreground">{log.shop_name}</span>
                            )}
                            {log.duration_ms != null && (
                              <span className="text-[10px] text-muted-foreground">{log.duration_ms}ms</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatTime(log.created_at)}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {log.user_name || log.user_email || "System"}
                        {log.source && log.source !== "manual" ? ` · ${log.source}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 4: Recent Push Events */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Push Events gần đây
            </h2>
          </div>

          <Card>
            <CardContent className="p-0">
              {pushLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Đang tải...</div>
              ) : !recentPush || recentPush.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Chưa có push event nào</div>
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
                            {push.shop_id ? shopNameMap.get(push.shop_id) || `Shop #${push.shop_id}` : "System"}
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
