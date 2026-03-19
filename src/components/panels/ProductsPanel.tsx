/**
 * ProductsPanel - UI component cho quản lý sản phẩm Shopee
 * Đọc dữ liệu từ database, sync tự động mỗi giờ bởi cron job
 * Sử dụng React Query để cache data, chỉ reload khi DB thay đổi
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search, Package, ChevronDown, ChevronUp, Link2, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { logCompletedActivity } from '@/lib/activity-logger';

import { ImageWithZoom } from '@/components/ui/image-with-zoom';

// Status tabs cho sản phẩm
const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NORMAL', label: 'Đang hoạt động' },
  { key: 'UNLIST', label: 'Đã ẩn' },
  { key: 'BANNED', label: 'Vi phạm' },
];

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

// Format relative time (e.g., "5 phút trước", "2 giờ trước")
function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Chưa đồng bộ';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProductsPanel({ shopId, userId }: ProductsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;


  // Query keys (memoized to prevent re-renders)
  const productsQueryKey = useMemo(() => ['products', shopId], [shopId]);
  const modelsQueryKey = useMemo(() => ['product-models', shopId], [shopId]);
  const syncStatusQueryKey = useMemo(() => ['products-sync-status', shopId], [shopId]);

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

  // Fetch sync status (for cache invalidation and display last sync time)
  // Query theo shop_id, lấy record có products_synced_at mới nhất (không phụ thuộc user_id)
  const { data: syncStatus } = useQuery({
    queryKey: syncStatusQueryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('apishopee_sync_status')
        .select('products_synced_at')
        .eq('shop_id', shopId)
        .not('products_synced_at', 'is', null)
        .order('products_synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!shopId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

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

  // Kiểm tra và sync products nếu có thay đổi
  const syncProducts = async () => {
    if (syncing) return;

    setSyncing(true);
    const startTime = new Date();
    try {
      const { data, error } = await supabase.functions.invoke('apishopee-product', {
        body: {
          action: 'check-updates',
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

      if (data?.has_changes === false) {
        toast({
          title: 'Không có thay đổi',
          description: 'Dữ liệu sản phẩm đã cập nhật mới nhất',
        });
      } else {
        toast({
          title: 'Đồng bộ thành công',
          description: `Đã đồng bộ ${data?.synced_count || 0} sản phẩm`,
        });
      }

      // Log activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'products_sync',
        actionCategory: 'products',
        actionDescription: data?.has_changes === false
          ? 'Kiểm tra sản phẩm: không có thay đổi'
          : `Đồng bộ sản phẩm: ${data?.synced_count || 0} sản phẩm`,
        status: 'success',
        source: 'manual',
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        responseData: {
          has_changes: data?.has_changes,
          synced_count: data?.synced_count,
        },
      });
    } catch (err) {
      toast({
        title: 'Lỗi đồng bộ',
        description: (err as Error).message,
        variant: 'destructive',
      });

      // Log failed activity
      logCompletedActivity({
        userId,
        shopId,
        actionType: 'products_sync',
        actionCategory: 'products',
        actionDescription: 'Đồng bộ sản phẩm thất bại',
        status: 'failed',
        source: 'manual',
        startedAt: startTime,
        completedAt: new Date(),
        durationMs: Date.now() - startTime.getTime(),
        errorMessage: (err as Error).message,
      });
    } finally {
      setSyncing(false);
    }
  };

  // Reset state khi shop thay đổi
  useEffect(() => {
    setExpandedItems(new Set());
    setCurrentPage(1);
    setStatusFilter('ALL');
    setSearchTerm('');
  }, [shopId]);

  // Đếm số lượng sản phẩm theo từng trạng thái
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: products.length };
    products.forEach(p => {
      const status = p.item_status || 'NORMAL';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Filter products theo status và search term
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter theo status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(p => p.item_status === statusFilter);
    }

    // Filter theo search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.item_name?.toLowerCase().includes(term) ||
        p.item_sku?.toLowerCase().includes(term) ||
        p.item_id.toString().includes(term)
      );
    }

    return filtered;
  }, [products, statusFilter, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
    <Card className="border-0 shadow-sm flex flex-col h-[calc(100vh-73px)]">
      <CardContent className="p-0 flex flex-col h-full overflow-hidden">
        {/* Sticky Header Section */}
        <div className="flex-shrink-0">
          {/* Status Tabs + Search + Actions - All in one row */}
          <div className="flex items-center justify-between border-b bg-card px-2 gap-2">
            {/* Left: Status Tabs */}
            <div className="flex items-center flex-shrink-0">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    'px-3 md:px-4 py-3 text-xs md:text-sm whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer',
                    statusFilter === tab.key
                      ? 'border-brand text-brand font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {(statusCounts[tab.key] || 0) > 0 && (
                    <span className="text-muted-foreground ml-1">({statusCounts[tab.key]})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Right: Search + Auto-sync + Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 py-2">
              {/* Search bar - hidden on mobile */}
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên, SKU, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs w-40 lg:w-52"
                />
              </div>

              {/* Last sync time indicator - hide on mobile */}
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground" title={syncStatus?.products_synced_at ? `Sync lúc: ${new Date(syncStatus.products_synced_at).toLocaleString('vi-VN')}` : 'Chưa đồng bộ'}>
                <Database className="h-3.5 w-3.5" />
                <span>Sync: {formatRelativeTime(syncStatus?.products_synced_at)}</span>
              </div>

              {/* Sync Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={syncProducts}
                disabled={loading || syncing}
                className="h-8 text-xs"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1 md:mr-1.5", (loading || syncing) && "animate-spin")} />
                <span className="hidden md:inline">{syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                <span className="md:hidden">Sync</span>
              </Button>
            </div>
          </div>

          {/* Mobile Search - Only visible on small screens */}
          <div className="md:hidden p-2 border-b bg-muted">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, SKU hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm h-9"
              />
            </div>
          </div>

          {/* Table Header - Desktop only */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted border-b text-sm font-medium text-muted-foreground">
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
          <div className="md:hidden px-3 py-2 bg-muted border-b text-xs font-medium text-muted-foreground">
            Danh sách sản phẩm ({filteredProducts.length})
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {(loading || syncing) && products.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-brand" />
              <span className="ml-2 text-muted-foreground">
                {syncing ? 'Đang đồng bộ từ Shopee...' : 'Đang tải...'}
              </span>
            </div>
          )}

          {/* Empty - chưa có data, cần sync */}
          {!loading && !syncing && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-3" />
              <p className="mb-4">Chưa có dữ liệu sản phẩm</p>
              <Button onClick={syncProducts} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Đồng bộ ngay
              </Button>
            </div>
          )}

          {/* Product List */}
          {paginatedProducts.map((product) => {
          const isExpanded = expandedItems.has(product.item_id);
          const productModels = modelsData[product.item_id] || [];
          const visibleModels = productModels.slice(0, isExpanded ? undefined : DEFAULT_VISIBLE_MODELS);
          const hasMoreModels = productModels.length > DEFAULT_VISIBLE_MODELS;
          const remainingModels = productModels.length - DEFAULT_VISIBLE_MODELS;

          return (
            <div key={product.id} className="border-b last:border-b-0">
              {/* Desktop Layout */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-4 hover:bg-accent">
                {/* Product Info */}
                <div className="col-span-3 flex gap-3">
                  <div className="relative flex-shrink-0">
                    <Checkbox className="absolute -left-0.5 top-0" />
                    {product.image_url_list?.[0] ? (
                      <div className="ml-5">
                        <ImageWithZoom
                          src={product.image_url_list[0]}
                          alt={product.item_name}
                          className="w-16 h-16 object-cover rounded border"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded border flex items-center justify-center ml-5">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                      {product.item_name}
                    </h3>
                    {product.brand_name && product.brand_name !== 'NoBrand' && (
                      <div className="flex items-center gap-1 text-xs text-brand mb-1">
                        <span className="bg-brand/10 px-1 rounded">🏷</span>
                        {product.brand_name}
                      </div>
                    )}
                    <div className="mt-1">
                      <span className={cn(
                        "text-xs",
                        product.item_status === 'NORMAL' ? "text-success" : "text-muted-foreground"
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
                            idx !== visibleModels.length - 1 && "border-b border-border"
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
                                <Link2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              )}
                              <div>
                                <div className="text-sm font-medium text-foreground">{model.model_name}</div>
                                <div className="text-xs text-muted-foreground">{model.model_sku}</div>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm font-medium text-brand">{formatPrice(model.current_price)}</span>
                            {model.original_price > model.current_price && (
                              <div className="text-xs text-muted-foreground line-through">{formatPrice(model.original_price)}</div>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={cn(
                              "text-sm",
                              model.total_available_stock === 0 ? "text-destructive" :
                              model.total_available_stock <= 10 ? "text-warning" : "text-muted-foreground"
                            )}>
                              {model.total_available_stock}
                            </span>
                          </div>
                        </div>
                      ))}

                      {hasMoreModels && (
                        <div className="py-2 border-t border-dashed border-border">
                          <button
                            onClick={() => toggleExpand(product.item_id)}
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
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
                          <div className="text-xs text-muted-foreground">SKU: {product.item_sku}</div>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium text-brand">{formatPrice(product.current_price)}</span>
                        {product.original_price > product.current_price && (
                          <div className="text-xs text-muted-foreground line-through">{formatPrice(product.original_price)}</div>
                        )}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={cn(
                          "text-sm",
                          product.total_available_stock === 0 ? "text-destructive" :
                          product.total_available_stock <= 10 ? "text-warning" : "text-muted-foreground"
                        )}>
                          {product.total_available_stock}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Time */}
                <div className="col-span-2 text-xs text-muted-foreground">
                  <div>Thời gian tạo</div>
                  <div className="font-medium text-foreground">{formatDateTime(product.create_time)}</div>
                  <div className="mt-2">Thời gian cập nhật</div>
                  <div className="font-medium text-foreground">{formatDateTime(product.update_time)}</div>
                </div>
              </div>

              {/* Mobile Layout - Card style */}
              <div className="md:hidden p-3 hover:bg-accent">
                {/* Product Header */}
                <div className="flex gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <Checkbox className="absolute -left-0.5 top-0" />
                    {product.image_url_list?.[0] ? (
                      <div className="ml-5">
                        <ImageWithZoom
                          src={product.image_url_list[0]}
                          alt={product.item_name}
                          className="w-14 h-14 object-cover rounded border"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-muted rounded border flex items-center justify-center ml-5">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                      {product.item_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded",
                        product.item_status === 'NORMAL' ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                      )}>
                        {product.item_status === 'NORMAL' ? 'Hoạt động' : product.item_status}
                      </span>
                      {product.brand_name && product.brand_name !== 'NoBrand' && (
                        <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded">
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
                          "flex items-center gap-2 py-2 px-2 bg-muted rounded-lg",
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
                          <div className="w-10 h-10 bg-background rounded border flex items-center justify-center flex-shrink-0">
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{model.model_name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{model.model_sku}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-brand">{formatPrice(model.current_price)}</div>
                          {model.original_price > model.current_price && (
                            <div className="text-[10px] text-muted-foreground line-through">{formatPrice(model.original_price)}</div>
                          )}
                        </div>
                        <div className="text-center flex-shrink-0 w-8">
                          <span className={cn(
                            "text-xs font-medium",
                            model.total_available_stock === 0 ? "text-destructive" :
                            model.total_available_stock <= 10 ? "text-warning" : "text-muted-foreground"
                          )}>
                            {model.total_available_stock}
                          </span>
                        </div>
                      </div>
                    ))}

                    {hasMoreModels && (
                      <button
                        onClick={() => toggleExpand(product.item_id)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
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
                  <div className="flex items-center justify-between py-2 px-2 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">
                      {product.item_sku ? `SKU: ${product.item_sku}` : 'Không có SKU'}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-semibold text-brand">{formatPrice(product.current_price)}</span>
                        {product.original_price > product.current_price && (
                          <div className="text-[10px] text-muted-foreground line-through">{formatPrice(product.original_price)}</div>
                        )}
                      </div>
                      <div className="text-center w-8">
                        <span className={cn(
                          "text-xs font-medium",
                          product.total_available_stock === 0 ? "text-destructive" :
                          product.total_available_stock <= 10 ? "text-warning" : "text-muted-foreground"
                        )}>
                          {product.total_available_stock}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Time - collapsed on mobile */}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                  <span>Tạo: {formatDateTime(product.create_time)}</span>
                  <span>•</span>
                  <span>Cập nhật: {formatDateTime(product.update_time)}</span>
                </div>
              </div>
            </div>
          );
        })}

          {/* Footer with Pagination */}
          {products.length > 0 && (
            <div className="px-3 md:px-4 py-2 md:py-3 border-t bg-muted flex items-center justify-between">
            <div className="text-xs md:text-sm text-muted-foreground">
              {syncing && (
                <span className="text-brand flex items-center gap-1 mr-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span className="hidden md:inline">Đang đồng bộ...</span>
                </span>
              )}
              <span>
                {filteredProducts.length > 0 ? (
                  <>
                    Hiển thị {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredProducts.length)} / {filteredProducts.length} sản phẩm
                    {searchTerm && ` (lọc từ ${products.length})`}
                  </>
                ) : (
                  `0/${products.length} sản phẩm`
                )}
              </span>
              {/* Last sync time on mobile */}
              <span className="lg:hidden ml-2 text-muted-foreground" title={syncStatus?.products_synced_at ? new Date(syncStatus.products_synced_at).toLocaleString('vi-VN') : undefined}>
                • Sync: {formatRelativeTime(syncStatus?.products_synced_at)}
              </span>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 md:h-8 md:w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers - Desktop */}
                <div className="hidden md:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "h-8 w-8 p-0",
                          currentPage === pageNum && "bg-brand hover:bg-brand/90"
                        )}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                {/* Page indicator - Mobile */}
                <span className="md:hidden text-xs text-foreground min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 md:h-8 md:w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ProductsPanel;
