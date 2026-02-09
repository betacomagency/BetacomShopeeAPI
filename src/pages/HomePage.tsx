/**
 * Home Page - Dashboard tổng quan
 * Hiển thị thống kê từ các kênh bán hàng (Shopee)
 */

import { Link } from 'react-router-dom';
import {
  Store,
  TrendingUp,
  ArrowRight,
  Zap,
  Package,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { ADMIN_EMAIL } from '@/config/menu-config';

// Platform icons
const ShopeeIcon = () => (
  <img
    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcS-HdfgUSCDmV_LNqOxasca8KcceWStGP_A&s"
    alt="Shopee"
    className="w-5 h-5 object-contain"
  />
);

// --- Helpers ---

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMinutes = Math.floor((now - then) / 60000);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// --- Skeleton Loaders ---

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${85 - i * 15}%` }} />
        ))}
      </CardContent>
    </Card>
  );
}

// --- Token Alerts (admin) ---

function TokenAlerts() {
  const { user, profile } = useAuth();
  const { shops: shopeeShops } = useShopeeAuth();

  const isAdmin =
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
    profile?.system_role === 'admin';

  if (!isAdmin) return null;
  if (!shopeeShops.length) return null;

  return null;
}

// --- Dashboard Content ---

function DashboardContent() {
  const { user } = useAuth();
  const { shops: shopeeShops, selectedShopId } = useShopeeAuth();

  const currentShop = shopeeShops.find(s => s.shop_id === selectedShopId);
  const dashboard = useDashboardData(selectedShopId, user?.id || null);

  const { products, flashSales, sync } = dashboard;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Token Alerts for Admin */}
      <TokenAlerts />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {currentShop?.shop_logo ? (
            <img
              src={currentShop.shop_logo}
              alt={currentShop.shop_name || 'Shop'}
              className="w-10 h-10 rounded-lg object-cover border border-slate-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Store className="w-5 h-5 text-orange-500" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              {currentShop?.shop_name || 'Dashboard'}
            </h1>
            <p className="text-sm text-slate-500">Tổng quan cửa hàng</p>
          </div>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-2">
          {sync.lastSyncedAt && (
            <span className="text-xs text-slate-400">
              Đồng bộ: {formatRelativeTime(sync.lastSyncedAt)}
            </span>
          )}
          {sync.isStale && (
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Dữ liệu cũ" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.triggerSync(true)}
            disabled={sync.isSyncing}
            className="cursor-pointer h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sync.isSyncing ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 text-xs hidden sm:inline">Đồng bộ</span>
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Quick Actions - first on mobile */}
        <div className="order-1 lg:order-3">
          <QuickActionsCard onSync={() => sync.triggerSync(true)} isSyncing={sync.isSyncing} />
        </div>

        {/* Products Overview */}
        <div className="order-2 lg:order-1 lg:row-span-2">
          {products.isLoading ? (
            <CardSkeleton lines={5} />
          ) : (
            <ProductOverviewCard
              counts={products.counts}
              topSellers={products.topSellers}
              lowStock={products.lowStock}
            />
          )}
        </div>

        {/* Flash Sale Summary */}
        <div className="order-3 lg:order-2">
          {flashSales.isLoading ? (
            <CardSkeleton lines={3} />
          ) : (
            <FlashSaleSummaryCard
              ongoing={flashSales.ongoing}
              upcoming={flashSales.upcoming}
              nextFlashSale={flashSales.nextFlashSale}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Product Overview Card ---

function ProductOverviewCard({
  counts,
  topSellers,
  lowStock,
}: {
  counts: { total: number; active: number; unlisted: number; banned: number };
  topSellers: Array<{ item_id: number; item_name: string; sold: number; current_price: number; currency: string; image_url_list: string[] | null }>;
  lowStock: Array<{ item_id: number; item_name: string; total_available_stock: number; image_url_list: string[] | null }>;
}) {
  const total = counts.total || 1;
  const activePercent = (counts.active / total) * 100;
  const unlistedPercent = (counts.unlisted / total) * 100;
  const bannedPercent = (counts.banned / total) * 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Tổng quan sản phẩm</CardTitle>
        <Link to="/products">
          <Button variant="ghost" size="sm" className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            Xem tất cả
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {counts.total === 0 ? (
          <div className="text-center py-8">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Chưa có sản phẩm nào</p>
            <p className="text-xs text-slate-400 mt-1">Đồng bộ sản phẩm từ Shopee để bắt đầu</p>
          </div>
        ) : (
          <>
            {/* Status Breakdown */}
            <div className="space-y-2">
              <div className="h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
                {activePercent > 0 && (
                  <div
                    className="bg-green-500 transition-all duration-300"
                    style={{ width: `${activePercent}%` }}
                  />
                )}
                {unlistedPercent > 0 && (
                  <div
                    className="bg-slate-400 transition-all duration-300"
                    style={{ width: `${unlistedPercent}%` }}
                  />
                )}
                {bannedPercent > 0 && (
                  <div
                    className="bg-red-500 transition-all duration-300"
                    style={{ width: `${bannedPercent}%` }}
                  />
                )}
              </div>
              <div className="flex gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Đang bán: {counts.active.toLocaleString('vi-VN')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                  Ẩn: {counts.unlisted.toLocaleString('vi-VN')}
                </span>
                {counts.banned > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Vi phạm: {counts.banned}
                  </span>
                )}
              </div>
            </div>

            {/* Top Sellers */}
            {topSellers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Sản phẩm bán chạy</h4>
                <div className="space-y-1.5">
                  {topSellers.map((product, i) => (
                    <div key={product.item_id} className="flex items-center gap-2.5 py-1.5">
                      <span className="text-xs text-slate-400 w-4 text-right font-medium">{i + 1}</span>
                      {product.image_url_list?.[0] ? (
                        <img
                          src={product.image_url_list[0]}
                          alt={product.item_name}
                          className="w-8 h-8 rounded object-cover border border-slate-100"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{product.item_name}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {product.sold?.toLocaleString('vi-VN') || 0} đã bán
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock Alert */}
            {lowStock.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Cảnh báo tồn kho thấp</span>
                </div>
                <div className="space-y-1">
                  {lowStock.map(item => (
                    <div key={item.item_id} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-slate-700 truncate flex-1 mr-2">{item.item_name}</span>
                      <Badge variant="destructive" className="text-xs shrink-0">
                        Còn {item.total_available_stock}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Flash Sale Summary Card ---

function FlashSaleSummaryCard({
  ongoing,
  upcoming,
  nextFlashSale,
}: {
  ongoing: number;
  upcoming: number;
  nextFlashSale: {
    flash_sale_id: number;
    start_time: number;
    end_time: number;
    item_count: number;
    enabled_item_count: number;
  } | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Flash Sale</CardTitle>
        <Link to="/flash-sale">
          <Button variant="ghost" size="sm" className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            Xem tất cả
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {ongoing === 0 && upcoming === 0 && !nextFlashSale ? (
          <div className="text-center py-6">
            <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Chưa có Flash Sale nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Status counts */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                <span className="text-sm text-slate-700">
                  Đang diễn ra: <span className="font-semibold">{ongoing}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span className="text-sm text-slate-700">
                  Sắp diễn ra: <span className="font-semibold">{upcoming}</span>
                </span>
              </div>
            </div>

            {/* Next flash sale */}
            {nextFlashSale && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Flash Sale tiếp theo</span>
                </div>
                <p className="text-sm text-slate-700">
                  {formatDateTime(nextFlashSale.start_time)} - {formatDateTime(nextFlashSale.end_time)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {nextFlashSale.enabled_item_count}/{nextFlashSale.item_count} sản phẩm
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Quick Actions Card ---

function QuickActionsCard({ onSync, isSyncing }: { onSync: () => void; isSyncing: boolean }) {
  const actions = [
    { label: 'Sản phẩm', icon: Package, path: '/products', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
    { label: 'Flash Sale', icon: Zap, path: '/flash-sale', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
    { label: 'Quản lý Shop', icon: Store, path: '/settings/shops', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Thao tác nhanh</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <Link key={action.path} to={action.path}>
                <div className={`flex items-center gap-2.5 p-3 rounded-lg min-h-[44px] cursor-pointer transition-colors duration-200 ${action.color}`}>
                  <Icon className="w-4.5 h-4.5" />
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
              </Link>
            );
          })}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-2.5 p-3 rounded-lg min-h-[44px] cursor-pointer transition-colors duration-200 text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Đồng bộ</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Main Export ---

export default function HomePage() {
  const { user } = useAuth();
  const { shops: shopeeShops, isLoading: isShopeeLoading } = useShopeeAuth();
  const isLoading = isShopeeLoading;
  const hasShops = shopeeShops.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return <LandingContent />;
  }

  if (!hasShops) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                <Store className="w-10 h-10 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Bắt đầu kết nối shop của bạn
              </h2>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Kết nối shop để bắt đầu quản lý đơn hàng, sản phẩm và xem thống kê
              </p>
              <div className="flex justify-center gap-3">
                <Link to="/settings/shops">
                  <Button className="bg-orange-500 hover:bg-orange-600 cursor-pointer">
                    <ShopeeIcon />
                    <span className="ml-2">Kết nối Shopee</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <DashboardContent />;
}

// Landing Content for non-logged in users
function LandingContent() {
  const features = [
    {
      title: 'Quản lý đa kênh',
      description: 'Kết nối và quản lý Shopee trong một nền tảng',
      icon: Store,
      color: 'from-orange-500 to-red-500',
    },
    {
      title: 'Tự động hóa',
      description: 'Flash Sale tự động, refresh token tự động',
      icon: Zap,
      color: 'from-amber-500 to-orange-500',
    },
    {
      title: 'Thống kê chi tiết',
      description: 'Theo dõi đơn hàng, doanh thu theo thời gian thực',
      icon: TrendingUp,
      color: 'from-blue-500 to-indigo-500',
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="text-center py-12">
        <img
          src="/logo_betacom.png"
          alt="BETACOM"
          className="w-20 h-20 rounded-2xl mx-auto mb-6 shadow-lg"
        />
        <h1 className="text-4xl font-bold text-slate-800 mb-4">
          Chào mừng đến với{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
            BETACOM
          </span>
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          Nền tảng quản lý đa kênh thương mại điện tử chuyên nghiệp
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6">
                <div
                  className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} mb-4`}
                >
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center">
        <Link to="/auth">
          <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 cursor-pointer">
            Đăng nhập để bắt đầu
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
