/**
 * useSyncData - Hook quản lý sync data từ Shopee
 * Hỗ trợ sync Flash Sales
 * Sử dụng React Query để cache sync status
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SyncStatus, STALE_MINUTES } from '@/lib/shopee/flash-sale';
import { useToast } from '@/hooks/use-toast';
import { logCompletedActivity } from '@/lib/activity-logger';

export interface UseSyncDataOptions {
  shopId: number;
  userId: string;
  autoSyncOnMount?: boolean;
  staleMinutes?: number;
}

export interface UseSyncDataReturn {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  isStale: boolean;
  triggerSync: (forceSync?: boolean) => Promise<void>;
  syncStatus: SyncStatus | null;
}

/**
 * Check if data is stale based on last sync time
 */
function isDataStale(lastSyncedAt: string | null, staleMinutes: number): boolean {
  if (!lastSyncedAt) return true;

  const lastSync = new Date(lastSyncedAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSync.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes > staleMinutes;
}

// Flash Sale interface từ Shopee API
interface ShopeeFlashSale {
  flash_sale_id: number;
  timeslot_id: number;
  status: number;
  start_time: number;
  end_time: number;
  enabled_item_count: number;
  item_count: number;
  type: number;
  remindme_count?: number;
  click_count?: number;
}

export function useSyncData(options: UseSyncDataOptions): UseSyncDataReturn {
  const {
    shopId,
    userId,
    autoSyncOnMount = false,
    staleMinutes = STALE_MINUTES,
  } = options;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Track if auto sync has been triggered for this session
  const autoSyncTriggeredRef = useRef(false);

  // Query key for sync status
  const queryKey = ['syncStatus', shopId, userId];

  // Fetch sync status using React Query
  const { data: syncStatus } = useQuery({
    queryKey,
    queryFn: async (): Promise<SyncStatus | null> => {
      if (!shopId || !userId) return null;

      const { data, error } = await supabase
        .from('apishopee_sync_status')
        .select('*')
        .eq('shop_id', shopId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[useSyncData] Error fetching sync status:', error);
        return null;
      }

      return data as SyncStatus | null;
    },
    enabled: !!shopId && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute - allow refetch after this time
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always refetch on mount to ensure fresh data
  });

  // Derived state
  const lastSyncedAt = syncStatus?.flash_sales_synced_at ?? null;

  const isStale = isDataStale(lastSyncedAt, staleMinutes);

  /**
   * Trigger sync with Shopee API - Gọi trực tiếp apishopee-flash-sale
   */
  const triggerSync = useCallback(async (_forceSync = false) => {
    if (!shopId || !userId) {
      console.error('[useSyncData] Missing shopId or userId');
      return;
    }

    if (isSyncing) {
      console.log('[useSyncData] Already syncing, skipping...');
      return;
    }

    setIsSyncing(true);
    setLastError(null);

    const PAGE_SIZE = 100;

    try {
      // Pagination: fetch tất cả flash sales
      let allFlashSales: ShopeeFlashSale[] = [];
      let offset = 0;
      let totalCount = 0;
      let pagesFetched = 0;

      console.log('[useSyncData] Fetching flash sales from Shopee API (paginated)...');

      do {
        const { data: apiResult, error: apiError } = await supabase.functions.invoke('apishopee-flash-sale', {
          body: {
            action: 'get-flash-sale-list',
            shop_id: shopId,
            type: 0, // 0 = All
            offset,
            limit: PAGE_SIZE,
          },
        });

        if (apiError) {
          // Nếu đã fetch được một số trang, giữ data đã có thay vì throw
          if (allFlashSales.length > 0) {
            console.warn(`[useSyncData] API error at page ${pagesFetched + 1}, keeping ${allFlashSales.length} fetched items:`, apiError.message);
            break;
          }
          throw new Error(apiError.message);
        }

        if (apiResult?.error) {
          if (allFlashSales.length > 0) {
            console.warn(`[useSyncData] API error at page ${pagesFetched + 1}, keeping ${allFlashSales.length} fetched items:`, apiResult.error);
            break;
          }
          throw new Error(apiResult.error);
        }

        const pageList: ShopeeFlashSale[] = apiResult?.response?.flash_sale_list || [];
        totalCount = apiResult?.response?.total_count || 0;
        allFlashSales = allFlashSales.concat(pageList);
        pagesFetched++;
        offset += PAGE_SIZE;

        console.log(`[useSyncData] Page ${pagesFetched}: ${pageList.length} items (total fetched: ${allFlashSales.length}/${totalCount})`);

        // Dừng khi đã lấy hết hoặc page trống
      } while (offset < totalCount && allFlashSales.length < totalCount);

      console.log(`[useSyncData] Done: ${allFlashSales.length} flash sales in ${pagesFetched} API calls`);

      if (allFlashSales.length > 0) {
        const syncedAt = new Date().toISOString();

        // Upsert thay vì delete+insert → an toàn hơn, fail giữa chừng không mất data
        // Chia thành batch 50 records để tránh payload quá lớn
        const BATCH_SIZE = 50;
        const syncedIds: number[] = [];

        for (let i = 0; i < allFlashSales.length; i += BATCH_SIZE) {
          const batch = allFlashSales.slice(i, i + BATCH_SIZE);
          const upsertData = batch.map(sale => ({
            shop_id: shopId,
            user_id: null,
            synced_by: userId,
            flash_sale_id: sale.flash_sale_id,
            timeslot_id: sale.timeslot_id,
            status: sale.status,
            start_time: sale.start_time,
            end_time: sale.end_time,
            enabled_item_count: sale.enabled_item_count || 0,
            item_count: sale.item_count || 0,
            type: sale.type,
            remindme_count: sale.remindme_count || 0,
            click_count: sale.click_count || 0,
            raw_response: sale,
            synced_at: syncedAt,
          }));

          const { error: upsertError } = await supabase
            .from('apishopee_flash_sale_data')
            .upsert(upsertData, { onConflict: 'shop_id,flash_sale_id' });

          if (upsertError) {
            console.error(`[useSyncData] Upsert error at batch ${Math.floor(i / BATCH_SIZE) + 1}:`, upsertError);
            // Tiếp tục batch khác thay vì throw
            continue;
          }

          syncedIds.push(...batch.map(s => s.flash_sale_id));
        }

        // Xóa flash sales không còn tồn tại trên Shopee (chỉ khi fetch đủ tất cả)
        if (allFlashSales.length >= totalCount && syncedIds.length > 0) {
          const { error: cleanupError } = await supabase
            .from('apishopee_flash_sale_data')
            .delete()
            .eq('shop_id', shopId)
            .lt('synced_at', syncedAt);

          if (cleanupError) {
            console.warn('[useSyncData] Cleanup stale data error:', cleanupError);
          }
        }
      }

      // Update sync status
      await supabase
        .from('apishopee_sync_status')
        .upsert({
          shop_id: shopId,
          user_id: userId,
          flash_sales_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'shop_id,user_id' });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) &&
            key[0] === 'realtime' &&
            key[1] === 'apishopee_flash_sale_data' &&
            key[2] === shopId;
        },
        refetchType: 'all',
      });

      toast({
        title: 'Đồng bộ thành công',
        description: `Đã đồng bộ ${allFlashSales.length} Flash Sales (${pagesFetched} lần gọi API)`,
      });

      // Log activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'flash_sale_sync',
        actionCategory: 'flash_sale',
        actionDescription: `Đồng bộ Flash Sale: ${allFlashSales.length}/${totalCount} chương trình`,
        status: 'success',
        source: 'manual',
        responseData: {
          synced_count: allFlashSales.length,
          total_count: totalCount,
          api_calls: pagesFetched,
        },
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      setLastError(errorMessage);

      toast({
        title: 'Lỗi đồng bộ',
        description: errorMessage,
        variant: 'destructive',
      });

      // Log failed activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'flash_sale_sync',
        actionCategory: 'flash_sale',
        actionDescription: 'Đồng bộ Flash Sale thất bại',
        status: 'failed',
        source: 'manual',
        errorMessage,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [shopId, userId, isSyncing, queryClient, toast, queryKey]);

  /**
   * Auto sync on mount - only once per session if data is stale
   */
  useEffect(() => {
    if (!autoSyncOnMount || !shopId || !userId) return;
    if (autoSyncTriggeredRef.current) return;
    if (syncStatus === undefined) return; // Wait for initial fetch

    const syncedAt = syncStatus?.flash_sales_synced_at;

    if (!syncStatus || isDataStale(syncedAt ?? null, staleMinutes)) {
      autoSyncTriggeredRef.current = true;
      triggerSync();
    }
  }, [autoSyncOnMount, shopId, userId, staleMinutes, syncStatus, triggerSync]);

  // Reset auto sync flag when shop changes
  useEffect(() => {
    autoSyncTriggeredRef.current = false;
  }, [shopId]);

  /**
   * Subscribe to sync status changes
   */
  useEffect(() => {
    if (!shopId || !userId) return;

    const channel = supabase
      .channel(`sync_status_${shopId}_${userId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apishopee_sync_status',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, userId, queryClient, queryKey]);

  return {
    isSyncing,
    lastSyncedAt,
    lastError,
    isStale,
    triggerSync,
    syncStatus: syncStatus ?? null,
  };
}
