/**
 * Hook: useShopInfo
 * Lấy thông tin shop từ Shopee API (3 API an toàn: info, profile, holiday)
 * Auto-refresh mỗi 10 phút để boost API success rate
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ShopAllData {
  info: {
    error?: string;
    message?: string;
    shop_name?: string;
    region?: string;
    status?: string;
    merchant_id?: number;
    is_cb?: boolean;
    is_sip?: boolean;
    is_upgraded_cbsc?: boolean;
    shop_fulfillment_flag?: string;
    is_main_shop?: boolean;
    is_direct_shop?: boolean;
    linked_main_shop_id?: number;
    linked_direct_shop_list?: unknown[];
    sip_affi_shops?: unknown[];
    is_one_awb?: boolean;
    is_mart_shop?: boolean;
    is_outlet_shop?: boolean;
    auth_time?: number;
    expire_time?: number;
  } | null;
  profile: {
    error?: string;
    message?: string;
    response?: {
      shop_logo?: string;
      description?: string;
      shop_name?: string;
    };
  } | null;
  holidayMode: {
    error?: string;
    message?: string;
    response?: {
      holiday_mode_on?: boolean;
      holiday_date_list?: Array<{
        date_from: number;
        date_to: number;
      }>;
    };
  } | null;
  _meta?: {
    total_apis: number;
    success: number;
    failed: number;
    timestamp: string;
  };
}

async function fetchAllShopData(shopId: number): Promise<ShopAllData> {
  const { data, error } = await supabase.functions.invoke('shopee-shop', {
    body: { action: 'get-all-shop-data', shop_id: shopId },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch shop data');
  }

  return data as ShopAllData;
}

export function useShopInfo(shopId: number | null) {
  return useQuery({
    queryKey: ['shop-all-info', shopId],
    queryFn: () => fetchAllShopData(shopId!),
    enabled: !!shopId,
    staleTime: 30 * 60 * 1000, // 30 phút - dùng cache lâu hơn
    gcTime: 60 * 60 * 1000, // 60 phút cache
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
