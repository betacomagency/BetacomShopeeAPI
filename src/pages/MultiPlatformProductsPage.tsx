/**
 * MultiPlatformProductsPage - Trang danh sách sản phẩm đa nền tảng
 * Redesigned với UI hiện đại và UX tốt hơn
 */

import { useState, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  Package,
  ChevronDown,
  ChevronUp,
  Store,
  Filter,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  Ban,
  Layers,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ImageWithZoom } from '@/components/ui/image-with-zoom';
import { ProductDetailDialog } from '@/components/products/ProductDetailDialog';
import {
  useMultiPlatformProducts,
  useAllShopsForProducts,
  type Platform,
  type ProductStatus,
  type UnifiedProduct,
} from '@/hooks/useMultiPlatformProducts';
import { cn } from '@/lib/utils';

// Platform Icons
const ShopeeIcon = ({ className }: { className?: string }) => (
  <img
    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcS-HdfgUSCDmV_LNqOxasca8KcceWStGP_A&s"
    alt="Shopee"
    className={cn('object-contain', className)}
  />
);

const LazadaIcon = ({ className }: { className?: string }) => (
  <img
    src="https://recland.s3.ap-southeast-1.amazonaws.com/company/19a57791bf92848b511de18eaebca94a.png"
    alt="Lazada"
    className={cn('object-contain', className)}
  />
);

// Format utilities
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Platform config
const platformConfig: Record<string, {
  icon: React.FC<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  gradient: string;
}> = {
  all: {
    icon: Layers,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    gradient: 'from-slate-500 to-slate-600',
  },
  shopee: {
    icon: ShopeeIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    gradient: 'from-orange-500 to-red-500',
  },
  lazada: {
    icon: LazadaIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    gradient: 'from-blue-500 to-indigo-500',
  },
};

// Status config
const statusConfig: Record<string, {
  icon: React.FC<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}> = {
  all: { icon: Layers, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Tất cả' },
  active: { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Đang hoạt động' },
  low_stock: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Sắp hết hàng' },
  out_of_stock: { icon: Package, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Hết hàng' },
  inactive: { icon: EyeOff, color: 'text-slate-500', bgColor: 'bg-slate-100', label: 'Đã ẩn' },
  banned: { icon: Ban, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Vi phạm' },
};

export function MultiPlatformProductsPage() {
  // Filters state
  const [platform, setPlatform] = useState<Platform>('all');
  const [shopId, setShopId] = useState<string>('all');
  const [status, setStatus] = useState<ProductStatus>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // UI state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<UnifiedProduct | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Data
  const allShops = useAllShopsForProducts();
  const { data, isLoading, refetch, isFetching } = useMultiPlatformProducts({
    platform,
    shopId: shopId === 'all' ? undefined : shopId,
    status,
    search: debouncedSearch,
  });

  const products = data?.products || [];
  const platformCounts = data?.platformCounts || [];
  const statusCounts = data?.statusCounts || [];

  // Debounce search
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Toggle expand
  const toggleExpand = (productId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Handle product click
  const handleProductClick = (product: UnifiedProduct) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  // Filter shops by platform
  const filteredShops = useMemo(() => {
    if (platform === 'all') return allShops;
    return allShops.filter(s => s.channel === platform);
  }, [allShops, platform]);

  const DEFAULT_VISIBLE_VARIANTS = 3;

  // Get active filters count
  const activeFiltersCount = [
    shopId !== 'all',
    status !== 'all',
    search.length > 0,
  ].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setShopId('all');
    setStatus('all');
    setSearch('');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Sản phẩm đa nền tảng</h1>
              <p className="text-sm text-slate-500">Quản lý sản phẩm từ Shopee và Lazada</p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25 cursor-pointer"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', (isLoading || isFetching) && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      {/* Platform Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {platformCounts.map((p) => {
          const config = platformConfig[p.platform] || platformConfig.all;
          const Icon = config.icon;
          const isActive = platform === p.platform;

          return (
            <button
              key={p.platform}
              onClick={() => {
                setPlatform(p.platform);
                setShopId('all');
              }}
              className={cn(
                'relative p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group overflow-hidden',
                isActive
                  ? `${config.borderColor} ${config.bgColor} shadow-lg`
                  : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'
              )}
            >
              {/* Background gradient on active */}
              {isActive && (
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-5',
                  config.gradient
                )} />
              )}

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
                    isActive ? config.bgColor : 'bg-slate-50'
                  )}>
                    {p.platform === 'shopee' ? (
                      <ShopeeIcon className="w-7 h-7" />
                    ) : p.platform === 'lazada' ? (
                      <LazadaIcon className="w-7 h-7" />
                    ) : (
                      <Icon className={cn('w-6 h-6', isActive ? config.color : 'text-slate-400')} />
                    )}
                  </div>
                  <div className="text-left">
                    <p className={cn(
                      'text-sm font-medium',
                      isActive ? config.color : 'text-slate-500'
                    )}>
                      {p.label}
                    </p>
                    <p className={cn(
                      'text-2xl font-bold',
                      isActive ? 'text-slate-800' : 'text-slate-700'
                    )}>
                      {p.count.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <Card className="border-0 shadow-lg shadow-slate-200/50">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Tìm theo tên, SKU hoặc ID sản phẩm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 text-base border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Shop filter */}
              <Select value={shopId} onValueChange={setShopId}>
                <SelectTrigger className="w-[220px] h-12 rounded-xl border-slate-200">
                  <div className="flex items-center gap-2 w-full">
                    {shopId === 'all' ? (
                      <Store className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : filteredShops.find(s => s.id === shopId)?.channel === 'shopee' ? (
                      <ShopeeIcon className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <LazadaIcon className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate">
                      {shopId === 'all'
                        ? 'Tất cả gian hàng'
                        : filteredShops.find(s => s.id === shopId)?.name || 'Chọn gian hàng'}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" textValue="Tất cả gian hàng">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>Tất cả gian hàng</span>
                    </div>
                  </SelectItem>
                  {filteredShops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.id} textValue={shop.name}>
                      <div className="flex items-center gap-2">
                        {shop.channel === 'shopee' ? (
                          <ShopeeIcon className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <LazadaIcon className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span className="truncate max-w-[150px]">{shop.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Advanced filter */}
              <Button
                variant="outline"
                className="h-12 rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <Filter className="w-4 h-4 mr-2" />
                Lọc nâng cao
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2 bg-orange-500 text-white">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              {/* Clear filters */}
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4 mr-1" />
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {statusCounts.map((s) => {
              const config = statusConfig[s.status] || statusConfig.all;
              const Icon = config.icon;
              const isActive = status === s.status;

              return (
                <button
                  key={s.status}
                  onClick={() => setStatus(s.status)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer',
                    isActive
                      ? 'bg-slate-800 text-white shadow-lg'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-white' : config.color)} />
                  <span>{s.label}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs',
                    isActive ? 'bg-white/20' : 'bg-slate-200'
                  )}>
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="border-0 shadow-lg shadow-slate-200/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b text-sm font-semibold text-slate-600">
            <div className="col-span-4 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Sản phẩm
            </div>
            <div className="col-span-5">
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2">Hàng hóa / SKU</div>
                <div className="col-span-2 text-right">Giá bán</div>
                <div className="col-span-1 text-center">Tồn kho</div>
              </div>
            </div>
            <div className="col-span-3">Cập nhật</div>
          </div>

          {/* Loading State */}
          {isLoading && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
              </div>
              <p className="text-slate-600 font-medium">Đang tải sản phẩm...</p>
              <p className="text-slate-400 text-sm mt-1">Vui lòng chờ trong giây lát</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium text-lg">Không tìm thấy sản phẩm</p>
              <p className="text-slate-400 text-sm mt-1 text-center max-w-md">
                Thử thay đổi bộ lọc hoặc đồng bộ sản phẩm từ Shopee và Lazada
              </p>
              <Button
                variant="outline"
                className="mt-4 cursor-pointer"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tải lại
              </Button>
            </div>
          )}

          {/* Product List */}
          <div className="divide-y divide-slate-100">
            {products.map((product, index) => {
              const isExpanded = expandedItems.has(product.id);
              const visibleVariants = product.variants.slice(0, isExpanded ? undefined : DEFAULT_VISIBLE_VARIANTS);
              const hasMoreVariants = product.variants.length > DEFAULT_VISIBLE_VARIANTS;
              const remainingVariants = product.variants.length - DEFAULT_VISIBLE_VARIANTS;
              const platformCfg = platformConfig[product.platform] || platformConfig.all;

              return (
                <div
                  key={product.id}
                  className={cn(
                    'transition-colors',
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  )}
                >
                  {/* Desktop Layout */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-5 hover:bg-orange-50/30 transition-colors">
                    {/* Product Info */}
                    <div
                      className="col-span-4 flex gap-4 cursor-pointer group"
                      onClick={() => handleProductClick(product)}
                    >
                      <div className="relative flex-shrink-0">
                        {product.image ? (
                          <ImageWithZoom
                            src={product.image}
                            alt={product.name}
                            className="w-20 h-20 object-cover rounded-xl border border-slate-200 group-hover:border-orange-300 transition-colors"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
                            <Package className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                        {/* Platform badge */}
                        <div className={cn(
                          'absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center shadow-sm',
                          product.platform === 'shopee' ? 'bg-orange-100' : 'bg-blue-100'
                        )}>
                          {product.platform === 'shopee' ? (
                            <ShopeeIcon className="w-4 h-4" />
                          ) : (
                            <LazadaIcon className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-orange-600 transition-colors">
                          {product.name}
                        </h3>

                        {product.brandName && product.brandName !== 'NoBrand' && (
                          <Badge variant="outline" className="mt-1 text-xs font-medium">
                            {product.brandName}
                          </Badge>
                        )}

                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
                            product.status === 'active' ? 'bg-green-100 text-green-700' :
                            product.status === 'banned' || product.status === 'deleted' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-600'
                          )}>
                            {product.status === 'active' ? (
                              <><Eye className="w-3 h-3" /> Hoạt động</>
                            ) : product.status === 'inactive' ? (
                              <><EyeOff className="w-3 h-3" /> Đã ẩn</>
                            ) : product.status === 'banned' ? (
                              <><Ban className="w-3 h-3" /> Vi phạm</>
                            ) : (
                              product.status
                            )}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[100px]">
                            {product.shopName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Variants + Price + Stock */}
                    <div className="col-span-5">
                      {product.hasVariants && product.variants.length > 0 ? (
                        <div className="space-y-0">
                          {visibleVariants.map((variant, idx) => (
                            <div
                              key={variant.id}
                              className={cn(
                                'grid grid-cols-5 gap-2 py-3',
                                idx !== visibleVariants.length - 1 && 'border-b border-slate-100'
                              )}
                            >
                              <div className="col-span-2 flex items-center gap-2">
                                <div className={cn(
                                  'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                                  product.platform === 'shopee' ? 'bg-orange-50' : 'bg-blue-50'
                                )}>
                                  {product.platform === 'shopee' ? (
                                    <ShopeeIcon className="w-3.5 h-3.5" />
                                  ) : (
                                    <LazadaIcon className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-700 truncate">
                                    {variant.name || variant.sku}
                                  </div>
                                  <div className="text-xs text-slate-400 truncate">{variant.sku}</div>
                                </div>
                              </div>
                              <div className="col-span-2 text-right">
                                <span className="text-sm font-bold text-orange-600">
                                  {formatPrice(variant.specialPrice || variant.price)}
                                </span>
                                {variant.originalPrice && variant.originalPrice > (variant.specialPrice || variant.price) && (
                                  <div className="text-xs text-slate-400 line-through">
                                    {formatPrice(variant.originalPrice)}
                                  </div>
                                )}
                              </div>
                              <div className="col-span-1 flex items-center justify-center">
                                <span className={cn(
                                  'text-sm font-bold px-2 py-1 rounded-lg',
                                  variant.stock === 0 ? 'bg-red-100 text-red-600' :
                                  variant.stock <= 10 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-slate-100 text-slate-700'
                                )}>
                                  {variant.stock}
                                </span>
                              </div>
                            </div>
                          ))}

                          {hasMoreVariants && (
                            <div className="pt-2">
                              <button
                                onClick={() => toggleExpand(product.id)}
                                className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1 font-medium cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-4 w-4" />
                                    Thu gọn
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    Xem thêm {remainingVariants} SKU
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2 py-3">
                          <div className="col-span-2">
                            {product.sku && (
                              <div className="text-xs text-slate-400">SKU: {product.sku}</div>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm font-bold text-orange-600">
                              {formatPrice(product.specialPrice || product.price)}
                            </span>
                            {product.originalPrice && product.originalPrice > (product.specialPrice || product.price) && (
                              <div className="text-xs text-slate-400 line-through">
                                {formatPrice(product.originalPrice)}
                              </div>
                            )}
                          </div>
                          <div className="col-span-1 flex items-center justify-center">
                            <span className={cn(
                              'text-sm font-bold px-2 py-1 rounded-lg',
                              product.stock === 0 ? 'bg-red-100 text-red-600' :
                              product.stock <= 10 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            )}>
                              {product.stock}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Time */}
                    <div className="col-span-3 flex flex-col justify-center">
                      <div className="text-xs text-slate-400 mb-1">Thời gian tạo</div>
                      <div className="text-sm font-medium text-slate-700 mb-3">{formatDate(product.createdAt)}</div>
                      <div className="text-xs text-slate-400 mb-1">Cập nhật lần cuối</div>
                      <div className="text-sm font-medium text-slate-700">{formatDate(product.updatedAt)}</div>
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div
                    className="md:hidden p-4 hover:bg-orange-50/30 cursor-pointer"
                    onClick={() => handleProductClick(product)}
                  >
                    <div className="flex gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded-xl border"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-100 rounded-xl border flex items-center justify-center">
                            <Package className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                        <div className={cn(
                          'absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center',
                          product.platform === 'shopee' ? 'bg-orange-100' : 'bg-blue-100'
                        )}>
                          {product.platform === 'shopee' ? (
                            <ShopeeIcon className="w-3 h-3" />
                          ) : (
                            <LazadaIcon className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            product.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                          )}>
                            {product.status === 'active' ? 'Hoạt động' : product.status}
                          </span>
                          <span className="text-[10px] text-slate-400">{product.shopName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Price & Stock on Mobile */}
                    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl">
                      <div>
                        <span className="text-sm font-bold text-orange-600">
                          {formatPrice(product.specialPrice || product.price)}
                        </span>
                      </div>
                      <div className={cn(
                        'text-sm font-bold px-2 py-1 rounded-lg',
                        product.stock === 0 ? 'bg-red-100 text-red-600' :
                        product.stock <= 10 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      )}>
                        {product.stock} tồn
                      </div>
                      {product.hasVariants && (
                        <div className="text-xs text-slate-400">
                          {product.variants.length} SKU
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {products.length > 0 && (
            <div className="px-6 py-4 border-t bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Hiển thị <span className="font-semibold text-slate-800">{products.length}</span> sản phẩm
              </div>
              {isFetching && (
                <div className="flex items-center gap-2 text-orange-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Đang cập nhật...</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        product={selectedProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default MultiPlatformProductsPage;
