/**
 * ProductsPanel - UI component cho quản lý sản phẩm Shopee
 * Đọc dữ liệu từ database, sync tự động mỗi giờ bởi cron job
 * Sử dụng React Query để cache data, chỉ reload khi DB thay đổi
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search, Package, ChevronDown, ChevronUp, Link2, Clock, Database, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

import { ImageWithZoom } from '@/components/ui/image-with-zoom';

interface ProductsPanelProps {
  shopId: number;
  userId: string;
}

// Product từ database
interface DBProduct {
  id: string;
  item_id: number;
  item_name: string;
  item_sku: string;
  item_status: string;
  category_id: number;
  image_url_list: string[];
  current_price: number;
  original_price: number;
  total_available_stock: number;
  brand_id: number | null;
  brand_name: string | null;
  has_model: boolean;
  create_time: number;
  update_time: number;
  synced_at: string;
}

// Model từ database
interface DBModel {
  id: string;
  item_id: number;
  model_id: number;
  model_sku: string;
  model_name: string;
  current_price: number;
  original_price: number;
  total_available_stock: number;
  image_url: string | null;
  tier_index: number[];
}

// Format price
function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
}

// Format date
function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

export function ProductsPanel({ shopId, userId }: ProductsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);

  // API Response state
  const [showApiResponse, setShowApiResponse] = useState(false);
  const [apiResponses, setApiResponses] = useState<Record<string, any>>({});
  const [loadingApiResponse, setLoadingApiResponse] = useState(false);

  // Query keys
  const productsQueryKey = ['products', shopId];
  const modelsQueryKey = ['product-models', shopId];
  const syncStatusQueryKey = ['products-sync-status', shopId];

  // Fetch products từ database với React Query (cache vĩnh viễn cho đến khi invalidate)
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: productsQueryKey,
    queryFn: async (): Promise<DBProduct[]> => {
      const { data, error } = await supabase
        .from('apishopee_products')
        .select('id, item_id, item_name, item_sku, item_status, category_id, image_url_list, current_price, original_price, total_available_stock, brand_id, brand_name, has_model, create_time, update_time, synced_at')
        .eq('shop_id', shopId)
        .order('update_time', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!shopId,
    staleTime: Infinity, // Không bao giờ stale - chỉ refetch khi invalidate
    gcTime: 30 * 60 * 1000, // Cache 30 phút
    refetchOnWindowFocus: false, // Không refetch khi focus window
    refetchOnMount: false, // Không refetch khi mount lại
    refetchOnReconnect: false, // Không refetch khi reconnect
  });

  // Fetch models từ database
  const { data: modelsData = {}, isLoading: loadingModels } = useQuery({
    queryKey: modelsQueryKey,
    queryFn: async (): Promise<Record<number, DBModel[]>> => {
      const { data, error } = await supabase
        .from('apishopee_product_models')
        .select('id, item_id, model_id, model_sku, model_name, current_price, original_price, total_available_stock, image_url, tier_index')
        .eq('shop_id', shopId);

      if (error) throw error;

      // Group models by item_id
      const modelsByItem: Record<number, DBModel[]> = {};
      (data || []).forEach(m => {
        if (!modelsByItem[m.item_id]) modelsByItem[m.item_id] = [];
        modelsByItem[m.item_id].push(m);
      });
      return modelsByItem;
    },
    enabled: !!shopId,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Fetch sync status
  const { data: syncStatus } = useQuery({
    queryKey: syncStatusQueryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('apishopee_sync_status')
        .select('products_synced_at')
        .eq('shop_id', shopId)
        .maybeSingle();
      return data;
    },
    enabled: !!shopId,
    staleTime: 60 * 1000, // 1 phút
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const lastSyncedAt = syncStatus?.products_synced_at || null;
  const loading = loadingProducts || loadingModels;

  // Subscribe to realtime changes - chỉ invalidate khi có thay đổi thực sự
  useEffect(() => {
    if (!shopId) return;

    const channel = supabase
      .channel(`products_${shopId}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apishopee_products',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          // Chỉ invalidate khi có thay đổi từ DB
          queryClient.invalidateQueries({ queryKey: productsQueryKey });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apishopee_product_models',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: modelsQueryKey });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apishopee_sync_status',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, queryClient, productsQueryKey, modelsQueryKey, syncStatusQueryKey]);

  // Sync products từ Shopee API (chạy background, không block UI)
  const syncProducts = async () => {
    if (syncing) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('apishopee-product', {
        body: {
          action: 'sync-products',
          shop_id: shopId,
          user_id: userId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Invalidate queries để refresh data
      await queryClient.invalidateQueries({ queryKey: productsQueryKey });
      await queryClient.invalidateQueries({ queryKey: modelsQueryKey });
      await queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });

      toast({
        title: 'Đồng bộ thành công',
        description: `Đã đồng bộ ${data?.synced_count || 0} sản phẩm`,
      });
    } catch (err) {
      toast({
        title: 'Lỗi đồng bộ',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Reset expanded items khi shop thay đổi
  useEffect(() => {
    setExpandedItems(new Set());
  }, [shopId]);

  // Fetch API responses để xem raw data từ Shopee
  const fetchAllApiResponses = async () => {
    setLoadingApiResponse(true);
    const responses: Record<string, any> = {};

    try {
      // 1. Get Item List - lấy danh sách item IDs (chỉ lấy trang đầu để demo)
      const { data: itemListRes, error: itemListErr } = await supabase.functions.invoke('apishopee-product', {
        body: {
          action: 'get-item-list',
          shop_id: shopId,
          offset: 0,
          page_size: 20,
          item_status: ['NORMAL'],
        },
      });
      responses['get-item-list'] = itemListErr ? { error: itemListErr.message } : itemListRes;

      // 2. Get Item Base Info - lấy chi tiết sản phẩm (nếu có item list)
      const itemIds = itemListRes?.response?.item?.map((i: any) => i.item_id)?.slice(0, 5) || [];
      if (itemIds.length > 0) {
        const { data: itemBaseInfoRes, error: itemBaseInfoErr } = await supabase.functions.invoke('apishopee-product', {
          body: {
            action: 'get-item-base-info',
            shop_id: shopId,
            item_id_list: itemIds,
          },
        });
        responses['get-item-base-info'] = itemBaseInfoErr ? { error: itemBaseInfoErr.message } : itemBaseInfoRes;

        // 3. Get Model List - lấy models/variants cho sản phẩm đầu tiên có has_model = true
        const itemWithModel = itemBaseInfoRes?.response?.item_list?.find((i: any) => i.has_model);
        if (itemWithModel) {
          const { data: modelListRes, error: modelListErr } = await supabase.functions.invoke('apishopee-product', {
            body: {
              action: 'get-model-list',
              shop_id: shopId,
              item_id: itemWithModel.item_id,
            },
          });
          responses['get-model-list'] = modelListErr ? { error: modelListErr.message } : {
            item_id: itemWithModel.item_id,
            item_name: itemWithModel.item_name,
            ...modelListRes,
          };
        }
      }

      setApiResponses(responses);
      setShowApiResponse(true);
      toast({ title: 'Đã tải API responses', description: `${Object.keys(responses).length} API calls` });
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoadingApiResponse(false);
    }
  };

  // Filter products theo search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.item_name?.toLowerCase().includes(term) ||
      p.item_sku?.toLowerCase().includes(term) ||
      p.item_id.toString().includes(term)
    );
  }, [products, searchTerm]);

  // Toggle expand item
  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Số lượng model hiển thị mặc định
  const DEFAULT_VISIBLE_MODELS = 4;


  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        {/* Header với sync status */}
        <div className="p-3 md:p-4 border-b">
          {/* Search bar */}
          <div className="relative mb-2 md:mb-0 md:max-w-md md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Tìm theo tên, SKU hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sync status - compact on mobile */}
              {lastSyncedAt && (
                <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span className="hidden md:inline">Đồng bộ:</span>
                  <span>{formatRelativeTime(lastSyncedAt)}</span>
                </div>
              )}

              {/* Auto-sync indicator - hide on mobile */}
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                <Database className="h-3.5 w-3.5" />
                <span>Tự động mỗi 1h</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAllApiResponses}
                disabled={loading || syncing || loadingApiResponse}
                className="h-8 text-xs hidden md:flex"
              >
                <FileJson className={cn("h-4 w-4 mr-2", loadingApiResponse && "animate-spin")} />
                Response
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={syncProducts}
                disabled={loading || syncing}
                className="h-8 text-xs"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1 md:mr-2", (loading || syncing) && "animate-spin")} />
                <span className="hidden md:inline">{syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                <span className="md:hidden">Sync</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Table Header - Desktop only */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b text-sm font-medium text-slate-600">
          <div className="col-span-3">Sản phẩm</div>
          <div className="col-span-7">
            <div className="grid grid-cols-7 gap-2">
              <div className="col-span-3">Hàng hóa</div>
              <div className="col-span-2 text-right">Giá niêm yết</div>
              <div className="col-span-2 text-center">Tồn kho</div>
            </div>
          </div>
          <div className="col-span-2">Thời gian</div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden px-3 py-2 bg-slate-50 border-b text-xs font-medium text-slate-600">
          Danh sách sản phẩm ({filteredProducts.length})
        </div>

        {/* Loading */}
        {(loading || syncing) && products.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
            <span className="ml-2 text-slate-500">
              {syncing ? 'Đang đồng bộ từ Shopee...' : 'Đang tải...'}
            </span>
          </div>
        )}

        {/* Empty - chưa có data, cần sync */}
        {!loading && !syncing && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Package className="h-12 w-12 mb-3" />
            <p className="mb-4">Chưa có dữ liệu sản phẩm</p>
            <Button onClick={syncProducts} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Đồng bộ ngay
            </Button>
          </div>
        )}

        {/* Product List */}
        {filteredProducts.map((product) => {
          const isExpanded = expandedItems.has(product.item_id);
          const productModels = modelsData[product.item_id] || [];
          const visibleModels = productModels.slice(0, isExpanded ? undefined : DEFAULT_VISIBLE_MODELS);
          const hasMoreModels = productModels.length > DEFAULT_VISIBLE_MODELS;
          const remainingModels = productModels.length - DEFAULT_VISIBLE_MODELS;

          return (
            <div key={product.id} className="border-b last:border-b-0">
              {/* Desktop Layout */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-4 hover:bg-slate-50/50">
                {/* Product Info */}
                <div className="col-span-3 flex gap-3">
                  <div className="relative flex-shrink-0">
                    <input type="checkbox" className="absolute -left-1 top-0 w-4 h-4" />
                    {product.image_url_list?.[0] ? (
                      <div className="ml-5">
                        <ImageWithZoom
                          src={product.image_url_list[0]}
                          alt={product.item_name}
                          className="w-16 h-16 object-cover rounded border"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-slate-100 rounded border flex items-center justify-center ml-5">
                        <Package className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-800 line-clamp-2 mb-1">
                      {product.item_name}
                    </h3>
                    {product.brand_name && product.brand_name !== 'NoBrand' && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 mb-1">
                        <span className="bg-orange-100 px-1 rounded">🏷</span>
                        {product.brand_name}
                      </div>
                    )}
                    <div className="mt-1">
                      <span className={cn(
                        "text-xs",
                        product.item_status === 'NORMAL' ? "text-green-600" : "text-slate-500"
                      )}>
                        {product.item_status === 'NORMAL' ? 'Hoạt động' : product.item_status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Models/Variants + Price + Stock */}
                <div className="col-span-7">
                  {product.has_model && productModels.length > 0 ? (
                    <div className="space-y-0">
                      {visibleModels.map((model, idx) => (
                        <div
                          key={model.id}
                          className={cn(
                            "grid grid-cols-7 gap-2 py-2.5",
                            idx !== visibleModels.length - 1 && "border-b border-slate-100"
                          )}
                        >
                          <div className="col-span-3">
                            <div className="flex items-start gap-2">
                              {model.image_url ? (
                                <ImageWithZoom
                                  src={model.image_url}
                                  alt={model.model_name}
                                  className="w-10 h-10 object-cover rounded border flex-shrink-0"
                                  zoomSize={200}
                                />
                              ) : (
                                <Link2 className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <div className="text-sm font-medium text-slate-700">{model.model_name}</div>
                                <div className="text-xs text-slate-400">{model.model_sku}</div>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm font-medium text-orange-600">{formatPrice(model.current_price)}</span>
                            {model.original_price > model.current_price && (
                              <div className="text-xs text-slate-400 line-through">{formatPrice(model.original_price)}</div>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={cn(
                              "text-sm",
                              model.total_available_stock === 0 ? "text-red-500" :
                              model.total_available_stock <= 10 ? "text-yellow-600" : "text-slate-600"
                            )}>
                              {model.total_available_stock}
                            </span>
                          </div>
                        </div>
                      ))}

                      {hasMoreModels && (
                        <div className="py-2 border-t border-dashed border-slate-200">
                          <button
                            onClick={() => toggleExpand(product.item_id)}
                            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Thu gọn
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Xem thêm {remainingModels} SKU
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-2 py-2">
                      <div className="col-span-3">
                        {product.item_sku && (
                          <div className="text-xs text-slate-400">SKU: {product.item_sku}</div>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium text-orange-600">{formatPrice(product.current_price)}</span>
                        {product.original_price > product.current_price && (
                          <div className="text-xs text-slate-400 line-through">{formatPrice(product.original_price)}</div>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={cn(
                          "text-sm",
                          product.total_available_stock === 0 ? "text-red-500" :
                          product.total_available_stock <= 10 ? "text-yellow-600" : "text-slate-600"
                        )}>
                          {product.total_available_stock}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="col-span-2 text-xs text-slate-500">
                  <div>Thời gian tạo</div>
                  <div className="font-medium text-slate-700">{formatDateTime(product.create_time)}</div>
                  <div className="mt-2">Thời gian cập nhật</div>
                  <div className="font-medium text-slate-700">{formatDateTime(product.update_time)}</div>
                </div>
              </div>

              {/* Mobile Layout - Card style */}
              <div className="md:hidden p-3 hover:bg-slate-50/50">
                {/* Product Header */}
                <div className="flex gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <input type="checkbox" className="absolute -left-1 top-0 w-4 h-4" />
                    {product.image_url_list?.[0] ? (
                      <div className="ml-5">
                        <ImageWithZoom
                          src={product.image_url_list[0]}
                          alt={product.item_name}
                          className="w-14 h-14 object-cover rounded border"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-slate-100 rounded border flex items-center justify-center ml-5">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-800 line-clamp-2 leading-tight">
                      {product.item_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        product.item_status === 'NORMAL' ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {product.item_status === 'NORMAL' ? 'Hoạt động' : product.item_status}
                      </span>
                      {product.brand_name && product.brand_name !== 'NoBrand' && (
                        <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                          {product.brand_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Models/Variants on Mobile */}
                {product.has_model && productModels.length > 0 ? (
                  <div className="space-y-2">
                    {visibleModels.map((model, idx) => (
                      <div
                        key={model.id}
                        className={cn(
                          "flex items-center gap-2 py-2 px-2 bg-slate-50 rounded-lg",
                          idx !== visibleModels.length - 1 && "mb-1"
                        )}
                      >
                        {model.image_url ? (
                          <ImageWithZoom
                            src={model.image_url}
                            alt={model.model_name}
                            className="w-10 h-10 object-cover rounded border flex-shrink-0"
                            zoomSize={150}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-200 rounded border flex items-center justify-center flex-shrink-0">
                            <Link2 className="h-3 w-3 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">{model.model_name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{model.model_sku}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-orange-600">{formatPrice(model.current_price)}</div>
                          {model.original_price > model.current_price && (
                            <div className="text-[10px] text-slate-400 line-through">{formatPrice(model.original_price)}</div>
                          )}
                        </div>
                        <div className="text-center flex-shrink-0 w-8">
                          <span className={cn(
                            "text-xs font-medium",
                            model.total_available_stock === 0 ? "text-red-500" :
                            model.total_available_stock <= 10 ? "text-yellow-600" : "text-slate-600"
                          )}>
                            {model.total_available_stock}
                          </span>
                        </div>
                      </div>
                    ))}

                    {hasMoreModels && (
                      <button
                        onClick={() => toggleExpand(product.item_id)}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 py-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Thu gọn
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Xem thêm {remainingModels} SKU
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2 px-2 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-400">
                      {product.item_sku ? `SKU: ${product.item_sku}` : 'Không có SKU'}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-semibold text-orange-600">{formatPrice(product.current_price)}</span>
                        {product.original_price > product.current_price && (
                          <div className="text-[10px] text-slate-400 line-through">{formatPrice(product.original_price)}</div>
                        )}
                      </div>
                      <div className="text-center w-8">
                        <span className={cn(
                          "text-xs font-medium",
                          product.total_available_stock === 0 ? "text-red-500" :
                          product.total_available_stock <= 10 ? "text-yellow-600" : "text-slate-600"
                        )}>
                          {product.total_available_stock}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Time - collapsed on mobile */}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                  <span>Tạo: {formatDateTime(product.create_time)}</span>
                  <span>•</span>
                  <span>Cập nhật: {formatDateTime(product.update_time)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        {products.length > 0 && (
          <div className="px-3 md:px-4 py-2 md:py-3 border-t bg-slate-50/50 flex items-center justify-between">
            <div className="text-xs md:text-sm text-slate-500">
              {filteredProducts.length}/{products.length} sản phẩm
            </div>
            <div className="flex items-center gap-2">
              {syncing && (
                <span className="text-[10px] md:text-xs text-orange-500 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span className="hidden md:inline">Đang đồng bộ...</span>
                  <span className="md:hidden">Sync...</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* API Response Dialog */}
        {showApiResponse && (
          <Dialog open={showApiResponse} onOpenChange={setShowApiResponse}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>API Responses - Products</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto space-y-4 py-4">
                {Object.entries(apiResponses).map(([apiName, response]) => (
                  <div key={apiName} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">
                        {apiName}
                        {apiName === 'get-item-list' && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (Lấy danh sách item IDs)
                          </span>
                        )}
                        {apiName === 'get-item-base-info' && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (Lấy chi tiết sản phẩm)
                          </span>
                        )}
                        {apiName === 'get-model-list' && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (Lấy models/variants)
                          </span>
                        )}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(response, null, 2));
                          toast({ title: 'Đã copy', description: `Response của ${apiName}` });
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <pre className="bg-slate-50 p-3 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowApiResponse(false)}>
                  Đóng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductsPanel;
