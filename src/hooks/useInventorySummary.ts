/**
 * useInventorySummary - Hook for inventory summary data
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ==================== INTERFACES ====================

export interface InventorySummary {
  totalQuantity: number;
  totalValueAtCost: number | null; // null = không có dữ liệu giá vốn
  totalValueAtSelling: number;
}

export interface UseInventorySummaryReturn {
  summary: InventorySummary;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_SUMMARY: InventorySummary = {
  totalQuantity: 0,
  totalValueAtCost: null,
  totalValueAtSelling: 0,
};

/**
 * Hook for inventory summary
 */
export function useInventorySummary(
  shopId: number,
  userId: string
): UseInventorySummaryReturn {
  const queryKey = useMemo(
    () => ['inventory-summary', shopId, userId],
    [shopId, userId]
  );

  const fetchInventory = useCallback(async (): Promise<InventorySummary> => {
    if (!shopId || !userId) return DEFAULT_SUMMARY;

    // Fetch from product_models for detailed stock
    const { data: models, error: modelsError } = await supabase
      .from('apishopee_product_models')
      .select('total_available_stock, current_price, original_price')
      .eq('shop_id', shopId);

    if (modelsError) {
      console.error('[useInventorySummary] Error fetching models:', modelsError);
      // Fallback to products table
    }

    if (models && models.length > 0) {
      let totalQuantity = 0;
      let totalValueAtSelling = 0;

      models.forEach(model => {
        const stock = model.total_available_stock || 0;
        const sellingPrice = Number(model.current_price) || 0;

        totalQuantity += stock;
        totalValueAtSelling += stock * sellingPrice;
      });

      return {
        totalQuantity,
        totalValueAtCost: null, // Chưa có dữ liệu giá vốn
        totalValueAtSelling: Math.round(totalValueAtSelling),
      };
    }

    // Fallback: fetch from products table (for items without models)
    const { data: products, error: productsError } = await supabase
      .from('apishopee_products')
      .select('total_available_stock, current_price, original_price')
      .eq('shop_id', shopId);

    if (productsError) {
      console.error('[useInventorySummary] Error fetching products:', productsError);
      throw new Error(productsError.message);
    }

    let totalQuantity = 0;
    let totalValueAtSelling = 0;

    (products || []).forEach(product => {
      const stock = product.total_available_stock || 0;
      const sellingPrice = Number(product.current_price) || 0;

      totalQuantity += stock;
      totalValueAtSelling += stock * sellingPrice;
    });

    return {
      totalQuantity,
      totalValueAtCost: null, // Chưa có dữ liệu giá vốn
      totalValueAtSelling: Math.round(totalValueAtSelling),
    };
  }, [shopId, userId]);

  const { data, isLoading, error, refetch: queryRefetch } = useQuery({
    queryKey,
    queryFn: fetchInventory,
    enabled: !!shopId && !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    summary: data || DEFAULT_SUMMARY,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
