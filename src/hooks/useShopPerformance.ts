import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { GetShopPerformanceResponse, ShopPerformanceMetricRow } from '@/lib/shopee/types';

async function callProxy<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('apishopee-proxy', { body });
  if (error) throw new Error(error.message || 'Proxy call failed');
  return data?.response?.data as T;
}

/** Phát hiện lỗi rate limit từ Shopee (error code 4xx hoặc message chứa "too many") */
function isRateLimit(msg: string): boolean {
  return /rate.?limit|too.?many|429/i.test(msg);
}

async function writeLog(entry: {
  sync_type: 'single' | 'all';
  shop_id?: number;
  shop_name?: string;
  status: 'success' | 'error' | 'rate_limited';
  metrics_count?: number;
  error_message?: string;
  duration_ms?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('apishopee_shop_performance_sync_logs').insert({
    ...entry,
    triggered_by: user?.id ?? null,
  });
}

export interface SyncAllProgress {
  total: number;
  done: number;
  current: string | null;
  errors: { shopId: number; shopName: string; message: string; rateLimited?: boolean }[];
}

export interface UseShopPerformanceResult {
  metrics: ShopPerformanceMetricRow[];
  hasSyncedData: boolean;
  isSyncing: boolean;
  isLoadingMetrics: boolean;
  syncError: string | null;
  syncAllProgress: SyncAllProgress | null;
  syncPerformance: () => Promise<void>;
  syncAllShops: (shops: { shop_id: number; shop_name: string | null }[]) => Promise<void>;
  loadLatestFromDB: () => Promise<void>;
}

export function useShopPerformance(shopId: number): UseShopPerformanceResult {
  const [metrics, setMetrics] = useState<ShopPerformanceMetricRow[]>([]);
  const [hasSyncedData, setHasSyncedData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Load latest metrics from DB ───────────────────────────────────────────
  const loadLatestFromDB = useCallback(async () => {
    if (!shopId) return;
    setIsLoadingMetrics(true);
    setSyncError(null);

    try {
      const { data: latest, error: latestError } = await supabase
        .from('apishopee_shop_performance_metrics')
        .select('synced_at')
        .eq('shop_id', shopId)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;

      if (latest) {
        const { data: metricsData, error: metricsError } = await supabase
          .from('apishopee_shop_performance_metrics')
          .select('*')
          .eq('shop_id', shopId)
          .eq('synced_at', latest.synced_at)
          .order('metric_type', { ascending: true });

        if (metricsError) throw metricsError;
        setMetrics((metricsData as ShopPerformanceMetricRow[]) || []);
        setHasSyncedData(true);
      } else {
        setMetrics([]);
        setHasSyncedData(false);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Tải dữ liệu thất bại');
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [shopId]);

  // ── Sync single shop ──────────────────────────────────────────────────────
  const syncPerformance = useCallback(async () => {
    if (!shopId) return;
    setIsSyncing(true);
    setSyncError(null);
    const t0 = Date.now();

    try {
      const apiResp = await callProxy<GetShopPerformanceResponse>({
        api_path: '/api/v2/account_health/get_shop_performance',
        method: 'GET',
        shop_id: shopId,
        params: {},
      });

      if (!apiResp) throw new Error('Không nhận được dữ liệu từ Shopee API');
      if (apiResp.error) throw new Error(apiResp.message || apiResp.error || 'Shopee API error');

      const metricList = apiResp.response?.metric_list || [];
      const syncedAt = new Date().toISOString();

      if (metricList.length > 0) {
        const metricRows = metricList.map((m) => ({
          shop_id: shopId,
          synced_at: syncedAt,
          metric_type: m.metric_type,
          metric_id: m.metric_id,
          parent_metric_id: m.parent_metric_id,
          metric_name: m.metric_name,
          current_period: m.current_period,
          last_period: m.last_period,
          unit: m.unit,
          target_value: m.target?.value ?? null,
          target_comparator: m.target?.comparator ?? null,
          exemption_end_date: m.exemption_end_date ?? null,
        }));

        const { error: insertError } = await supabase
          .from('apishopee_shop_performance_metrics')
          .insert(metricRows);

        if (insertError) throw insertError;
      }

      await writeLog({ sync_type: 'single', shop_id: shopId, status: 'success', metrics_count: metricList.length, duration_ms: Date.now() - t0 });
      await loadLatestFromDB();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync thất bại';
      await writeLog({ sync_type: 'single', shop_id: shopId, status: isRateLimit(msg) ? 'rate_limited' : 'error', error_message: msg, duration_ms: Date.now() - t0 });
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  }, [shopId, loadLatestFromDB]);

  // ── Sync All Shops ────────────────────────────────────────────────────────
  const [syncAllProgress, setSyncAllProgress] = useState<SyncAllProgress | null>(null);

  const syncAllShops = useCallback(async (shops: { shop_id: number; shop_name: string | null }[]) => {
    if (!shops.length) return;
    const errors: SyncAllProgress['errors'] = [];
    setSyncAllProgress({ total: shops.length, done: 0, current: null, errors: [] });
    setIsSyncing(true);
    setSyncError(null);

    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      const shopLabel = shop.shop_name || String(shop.shop_id);
      setSyncAllProgress({ total: shops.length, done: i, current: shopLabel, errors: [...errors] });
      const t0 = Date.now();

      try {
        const apiResp = await callProxy<GetShopPerformanceResponse>({
          api_path: '/api/v2/account_health/get_shop_performance',
          method: 'GET',
          shop_id: shop.shop_id,
          params: {},
        });

        if (!apiResp) throw new Error('Không nhận được dữ liệu');
        if (apiResp.error) throw new Error(apiResp.message || apiResp.error);

        const metricList = apiResp.response?.metric_list || [];
        const syncedAt = new Date().toISOString();

        if (metricList.length > 0) {
          const metricRows = metricList.map((m) => ({
            shop_id: shop.shop_id,
            synced_at: syncedAt,
            metric_type: m.metric_type,
            metric_id: m.metric_id,
            parent_metric_id: m.parent_metric_id,
            metric_name: m.metric_name,
            current_period: m.current_period,
            last_period: m.last_period,
            unit: m.unit,
            target_value: m.target?.value ?? null,
            target_comparator: m.target?.comparator ?? null,
            exemption_end_date: m.exemption_end_date ?? null,
          }));

          const { error: insertError } = await supabase
            .from('apishopee_shop_performance_metrics')
            .insert(metricRows);

          if (insertError) throw insertError;
        }

        await writeLog({ sync_type: 'all', shop_id: shop.shop_id, shop_name: shopLabel, status: 'success', metrics_count: metricList.length, duration_ms: Date.now() - t0 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync thất bại';
        const rateLimited = isRateLimit(msg);
        errors.push({ shopId: shop.shop_id, shopName: shopLabel, message: msg, rateLimited });
        await writeLog({ sync_type: 'all', shop_id: shop.shop_id, shop_name: shopLabel, status: rateLimited ? 'rate_limited' : 'error', error_message: msg, duration_ms: Date.now() - t0 });
      }
    }

    setSyncAllProgress({ total: shops.length, done: shops.length, current: null, errors });
    setIsSyncing(false);
    await loadLatestFromDB();
  }, [loadLatestFromDB]);

  return {
    metrics,
    hasSyncedData,
    isSyncing,
    isLoadingMetrics,
    syncError,
    syncAllProgress,
    syncPerformance,
    syncAllShops,
    loadLatestFromDB,
  };
}
