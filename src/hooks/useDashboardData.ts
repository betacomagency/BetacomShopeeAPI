/**
 * useDashboardData - Hook tổng hợp dữ liệu cho dashboard trang chủ
 * Aggregates: products, flash sales, sync status
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFlashSaleData } from '@/hooks/useRealtimeData';
import { useSyncData } from '@/hooks/useSyncData';

interface ProductCounts {
  total: number;
  active: number;
  unlisted: number;
  banned: number;
}

interface TopProduct {
  item_id: number;
  item_name: string;
  sold: number;
  current_price: number;
  currency: string;
  image_url_list: string[] | null;
}

interface LowStockProduct {
  item_id: number;
  item_name: string;
  total_available_stock: number;
  image_url_list: string[] | null;
}

export interface DashboardData {
  products: {
    counts: ProductCounts;
    topSellers: TopProduct[];
    lowStock: LowStockProduct[];
    isLoading: boolean;
  };
  flashSales: {
    total: number;
    upcoming: number;
    ongoing: number;
    nextFlashSale: {
      flash_sale_id: number;
      start_time: number;
      end_time: number;
      item_count: number;
      enabled_item_count: number;
    } | null;
    isLoading: boolean;
  };
  sync: {
    lastSyncedAt: string | null;
    isStale: boolean;
    isSyncing: boolean;
    triggerSync: (forceSync?: boolean) => Promise<void>;
  };
  isLoading: boolean;
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useDashboardData(shopId: number | null, userId: string | null): DashboardData {
  // --- Products: counts by status ---
  const { data: productCounts, isLoading: isCountsLoading } = useQuery({
    queryKey: ['dashboard-product-counts', shopId],
    queryFn: async (): Promise<ProductCounts> => {
      const { data, error } = await supabase
        .from('apishopee_products')
        .select('item_status')
        .eq('shop_id', shopId!);

      if (error) throw error;

      const items = data || [];
      return {
        total: items.length,
        active: items.filter(i => i.item_status === 'NORMAL').length,
        unlisted: items.filter(i => i.item_status === 'UNLIST').length,
        banned: items.filter(i => i.item_status === 'BANNED').length,
      };
    },
    enabled: !!shopId,
    staleTime: STALE_TIME,
  });

  // --- Products: top sellers ---
  const { data: topSellers, isLoading: isTopLoading } = useQuery({
    queryKey: ['dashboard-top-sellers', shopId],
    queryFn: async (): Promise<TopProduct[]> => {
      const { data, error } = await supabase
        .from('apishopee_products')
        .select('item_id, item_name, sold, current_price, currency, image_url_list')
        .eq('shop_id', shopId!)
        .eq('item_status', 'NORMAL')
        .order('sold', { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data || []) as TopProduct[];
    },
    enabled: !!shopId,
    staleTime: STALE_TIME,
  });

  // --- Products: low stock ---
  const { data: lowStock, isLoading: isLowStockLoading } = useQuery({
    queryKey: ['dashboard-low-stock', shopId],
    queryFn: async (): Promise<LowStockProduct[]> => {
      const { data, error } = await supabase
        .from('apishopee_products')
        .select('item_id, item_name, total_available_stock, image_url_list')
        .eq('shop_id', shopId!)
        .eq('item_status', 'NORMAL')
        .lte('total_available_stock', 5)
        .gt('total_available_stock', 0)
        .order('total_available_stock', { ascending: true })
        .limit(5);

      if (error) throw error;
      return (data || []) as LowStockProduct[];
    },
    enabled: !!shopId,
    staleTime: STALE_TIME,
  });

  // --- Flash Sales (reuse existing hook) ---
  const flashSaleResult = useFlashSaleData(shopId || 0, userId || '');
  const flashSaleData = shopId && userId ? flashSaleResult.data : [];
  const isFlashSaleLoading = shopId && userId ? flashSaleResult.loading : false;

  const now = Math.floor(Date.now() / 1000);
  const ongoing = flashSaleData.filter(fs => fs.status === 2);
  const upcoming = flashSaleData.filter(fs => fs.status === 1 && fs.end_time > now);

  const nextFlashSale = upcoming
    .filter(fs => fs.start_time > now)
    .sort((a, b) => a.start_time - b.start_time)[0] || null;

  // --- Sync Status (reuse existing hook) ---
  const syncData = useSyncData({
    shopId: shopId || 0,
    userId: userId || '',
  });

  const isProductsLoading = isCountsLoading || isTopLoading || isLowStockLoading;

  return {
    products: {
      counts: productCounts || { total: 0, active: 0, unlisted: 0, banned: 0 },
      topSellers: topSellers || [],
      lowStock: lowStock || [],
      isLoading: isProductsLoading,
    },
    flashSales: {
      total: flashSaleData.length,
      upcoming: upcoming.length,
      ongoing: ongoing.length,
      nextFlashSale: nextFlashSale ? {
        flash_sale_id: nextFlashSale.flash_sale_id,
        start_time: nextFlashSale.start_time,
        end_time: nextFlashSale.end_time,
        item_count: nextFlashSale.item_count,
        enabled_item_count: nextFlashSale.enabled_item_count,
      } : null,
      isLoading: isFlashSaleLoading,
    },
    sync: {
      lastSyncedAt: syncData.lastSyncedAt,
      isStale: syncData.isStale,
      isSyncing: syncData.isSyncing,
      triggerSync: syncData.triggerSync,
    },
    isLoading: isProductsLoading || isFlashSaleLoading,
  };
}
