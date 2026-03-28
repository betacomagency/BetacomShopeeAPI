/**
 * useRealtimeData - Generic hook for realtime data subscription
 * Uses React Query for caching + Supabase realtime for updates
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface UseRealtimeDataOptions {
  orderBy?: string;
  orderAsc?: boolean;
  filter?: Record<string, unknown>;
  enabled?: boolean;
  staleTime?: number;
  /** Auto refetch interval in milliseconds. Set to false to disable. */
  refetchInterval?: number | false;
}

export interface UseRealtimeDataReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Timestamp of last successful data fetch */
  dataUpdatedAt: number | undefined;
  /** Whether a background refetch is in progress */
  isFetching: boolean;
}

export function useRealtimeData<T>(
  tableName: string,
  shopId: number,
  userId: string,
  options: UseRealtimeDataOptions = {}
): UseRealtimeDataReturn<T> {
  const { 
    orderBy = 'created_at', 
    orderAsc = false, 
    filter,
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    refetchInterval = false, // Disabled by default
  } = options;

  const queryClient = useQueryClient();
  const filterRef = useRef(filter);
  filterRef.current = filter;

  // Query key for caching
  const queryKey = ['realtime', tableName, shopId, userId, orderBy, orderAsc, JSON.stringify(filter)];

  // Fetch function
  const fetchData = async (): Promise<T[]> => {
    if (!shopId || !userId) {
      return [];
    }

    // Note: RLS policy handles user access control via apishopee_shop_members
    // We only need to filter by shop_id
    let query = supabase
      .from(tableName)
      .select('*')
      .eq('shop_id', shopId);

    // Apply additional filters
    if (filterRef.current) {
      Object.entries(filterRef.current).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply ordering
    query = query.order(orderBy, { ascending: orderAsc });

    const { data: result, error: queryError } = await query;

    if (queryError) {
      throw new Error(queryError.message);
    }

    return (result as T[]) || [];
  };

  // Use React Query for caching
  const { data, isLoading, isFetching, error, refetch: queryRefetch, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: fetchData,
    enabled: enabled && !!shopId && !!userId,
    staleTime,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when tab becomes active
    refetchOnMount: false, // Don't refetch on mount if data exists in cache
    refetchInterval: refetchInterval, // Auto refetch at specified interval
    refetchIntervalInBackground: false, // Don't refetch when tab is not focused
    retry: 2, // Retry failed requests
    retryDelay: 1000, // Wait 1 second between retries
    placeholderData: (previousData) => previousData, // Keep previous data while refetching to prevent UI flicker
  });

  // Invalidate và refetch khi shopId thay đổi
  // Sử dụng queryClient.invalidateQueries thay vì queryRefetch để đảm bảo data mới được fetch
  const prevShopIdRef = useRef(shopId);
  useEffect(() => {
    if (shopId && userId && enabled) {
      // Nếu shopId thay đổi, reset cache của shop cũ và fetch data mới
      if (prevShopIdRef.current !== shopId && prevShopIdRef.current !== undefined) {
        console.log(`[useRealtimeData] Shop changed from ${prevShopIdRef.current} to ${shopId}, clearing cache and refetching`);
        // Remove cache của shop cũ
        queryClient.removeQueries({ 
          queryKey: ['realtime', tableName, prevShopIdRef.current, userId]
        });
      }
      prevShopIdRef.current = shopId;
    }
  }, [shopId, userId, enabled, tableName, queryClient]);

  // Subscribe to realtime changes - only invalidate cache, don't refetch directly
  useEffect(() => {
    if (!shopId || !userId || !enabled) return;

    const channelName = `${tableName}_${shopId}_${userId}_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `shop_id=eq.${shopId}`,
        },
        (payload) => {
          console.log(`[useRealtimeData] ${tableName} changed:`, payload.eventType);
          // Invalidate cache to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['realtime', tableName, shopId, userId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useRealtimeData] ${tableName} subscription active`);
        }
      });

    return () => {
      console.log(`[useRealtimeData] Unsubscribing from ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [tableName, shopId, userId, enabled, queryClient]);

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    data: data || [],
    loading: isLoading && !data, // Only show loading if no cached data
    error: error ? (error as Error).message : null,
    refetch,
    dataUpdatedAt,
    isFetching, // Expose isFetching for background refresh indicator
  };
}

/**
 * Specialized hook for Flash Sale data
 * Data is synced by cron job every 30 minutes
 * Realtime subscription handles UI updates when DB changes
 */
export function useFlashSaleData(shopId: number, userId: string) {
  return useRealtimeData<{
    id: string;
    shop_id: number;
    user_id: string;
    flash_sale_id: number;
    timeslot_id: number;
    status: number;
    start_time: number;
    end_time: number;
    enabled_item_count: number;
    item_count: number;
    type: number;
    remindme_count: number;
    click_count: number;
    raw_response: Record<string, unknown> | null;
    synced_at: string;
    created_at: string;
    updated_at: string;
  }>('apishopee_flash_sale_data', shopId, userId, {
    orderBy: 'start_time',
    orderAsc: false,
    staleTime: 2 * 60 * 1000, // 2 minutes - allow refetch after this time
    refetchInterval: false, // Disabled - cron job handles sync
  });
}
