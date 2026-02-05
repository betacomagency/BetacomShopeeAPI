/**
 * useBestSellingProducts - Hook for best selling products data
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DateRangeOption } from './useDashboardData';

// ==================== INTERFACES ====================

export interface BestSellingProduct {
  rank: number;
  itemId: number;
  modelId: number;
  itemName: string;
  modelName: string;
  modelSku: string;
  quantitySold: number;
  quantityReturned: number;
  revenue: number;
}

export interface UseBestSellingProductsReturn {
  products: BestSellingProduct[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export type TopLimitOption = 10 | 20 | 50 | 100;

// Date range helpers (reuse logic from useDashboardData)
function getDateRange(option: DateRangeOption): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let start: Date;
  let end: Date;

  switch (option) {
    case 'today': {
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      end = new Date(today);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '7days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '14days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 13);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '30days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(today);
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last_week': {
      const dayOfWeek2 = today.getDay();
      const diffToMonday2 = dayOfWeek2 === 0 ? 6 : dayOfWeek2 - 1;
      end = new Date(today);
      end.setDate(end.getDate() - diffToMonday2 - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    default: {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }
  }

  return { start, end };
}

function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

interface OrderItem {
  item_id: number;
  model_id: number;
  item_name: string;
  model_name?: string;
  model_sku?: string;
  model_quantity_purchased: number;
  model_discounted_price: number;
}

/**
 * Hook for best selling products
 */
export function useBestSellingProducts(
  shopId: number,
  userId: string,
  dateRange: DateRangeOption = '7days',
  topLimit: TopLimitOption = 10
): UseBestSellingProductsReturn {
  const queryKey = useMemo(
    () => ['best-selling-products', shopId, userId, dateRange, topLimit],
    [shopId, userId, dateRange, topLimit]
  );

  const fetchBestSelling = useCallback(async (): Promise<BestSellingProduct[]> => {
    if (!shopId || !userId) return [];

    const { start, end } = getDateRange(dateRange);
    const startTs = toUnixTimestamp(start);
    const endTs = toUnixTimestamp(end);

    // Fetch ALL orders using pagination (Supabase default limit is 1000)
    const BATCH_SIZE = 1000;

    // Fetch sold orders with pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allSoldOrders: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('apishopee_orders')
        .select('item_list, total_amount')
        .eq('shop_id', shopId)
        .gte('create_time', startTs)
        .lte('create_time', endTs)
        .not('order_status', 'in', '("CANCELLED","IN_CANCEL")')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('[useBestSellingProducts] Error fetching sold orders:', error);
        throw new Error(error.message);
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allSoldOrders = [...allSoldOrders, ...batch];
        offset += BATCH_SIZE;
        hasMore = batch.length === BATCH_SIZE;
      }
    }

    const soldOrders = allSoldOrders;

    // Fetch returned orders with pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allReturnedOrders: any[] = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('apishopee_orders')
        .select('item_list')
        .eq('shop_id', shopId)
        .gte('create_time', startTs)
        .lte('create_time', endTs)
        .eq('order_status', 'TO_RETURN')
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('[useBestSellingProducts] Error fetching returned orders:', error);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allReturnedOrders = [...allReturnedOrders, ...batch];
        offset += BATCH_SIZE;
        hasMore = batch.length === BATCH_SIZE;
      }
    }

    const returnedOrders = allReturnedOrders;

    // Aggregate by item+model
    const productMap = new Map<string, {
      itemId: number;
      modelId: number;
      itemName: string;
      modelName: string;
      modelSku: string;
      quantitySold: number;
      quantityReturned: number;
      revenue: number;
    }>();

    // Process sold orders
    (soldOrders || []).forEach(order => {
      const items = order.item_list as OrderItem[] | null;
      if (!items) return;

      items.forEach(item => {
        const key = `${item.item_id}-${item.model_id}`;
        const existing = productMap.get(key);
        const qty = item.model_quantity_purchased || 1;
        const price = item.model_discounted_price || 0;

        if (existing) {
          existing.quantitySold += qty;
          existing.revenue += qty * price;
        } else {
          productMap.set(key, {
            itemId: item.item_id,
            modelId: item.model_id,
            itemName: item.item_name || '',
            modelName: item.model_name || '',
            modelSku: item.model_sku || '',
            quantitySold: qty,
            quantityReturned: 0,
            revenue: qty * price,
          });
        }
      });
    });

    // Process returned orders
    (returnedOrders || []).forEach(order => {
      const items = order.item_list as OrderItem[] | null;
      if (!items) return;

      items.forEach(item => {
        const key = `${item.item_id}-${item.model_id}`;
        const existing = productMap.get(key);
        const qty = item.model_quantity_purchased || 1;

        if (existing) {
          existing.quantityReturned += qty;
        }
      });
    });

    // Sort by revenue descending and limit
    const sorted = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topLimit);

    // Add rank
    return sorted.map((product, index) => ({
      ...product,
      rank: index + 1,
    }));
  }, [shopId, userId, dateRange, topLimit]);

  const { data, isLoading, error, refetch: queryRefetch } = useQuery({
    queryKey,
    queryFn: fetchBestSelling,
    enabled: !!shopId && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    products: data || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

// Top limit options for UI
export const TOP_LIMIT_OPTIONS: TopLimitOption[] = [10, 20, 50, 100];

export const TOP_LIMIT_LABELS: Record<TopLimitOption, string> = {
  10: 'Top 10',
  20: 'Top 20',
  50: 'Top 50',
  100: 'Top 100',
};
