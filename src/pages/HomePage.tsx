/**
 * Home Page - Dashboard tổng quan đa kênh
 * Hiển thị thống kê từ tất cả các kênh bán hàng (Shopee, Lazada)
 */

import { Link } from 'react-router-dom';
import {
  Store,
  TrendingUp,
  Clock,
  AlertCircle,
  ArrowRight,
  Zap,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useLazadaAuth } from '@/contexts/LazadaAuthContext';
import { cn } from '@/lib/utils';
import { ADMIN_EMAIL } from '@/config/menu-config';
import { useInventorySummary } from '@/hooks/useInventorySummary';
import { InventorySummary } from '@/components/dashboard/InventorySummary';

// Platform icons
const ShopeeIcon = () => (
  <img
    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcS-HdfgUSCDmV_LNqOxasca8KcceWStGP_A&s"
    alt="Shopee"
    className="w-5 h-5 object-contain"
  />
);

const LazadaIcon = () => (
  <img
    src="https://recland.s3.ap-southeast-1.amazonaws.com/company/19a57791bf92848b511de18eaebca94a.png"
    alt="Lazada"
    className="w-5 h-5 object-contain"
  />
);

// Token status alert for admin
function TokenAlerts() {
  const { user, profile } = useAuth();
  const { shops: shopeeShops } = useShopeeAuth();
  const { shops: lazadaShops } = useLazadaAuth();

  const isAdmin =
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
    profile?.system_role === 'admin';

  if (!isAdmin) return null;

  // Check for expiring tokens
  const now = Date.now();
  const expiringShops: { name: string; channel: string; daysLeft: number }[] = [];

  // TODO: Add token expiry check for Shopee shops
  // For now, Lazada shops have explicit token expiry
  lazadaShops.forEach((shop) => {
    if (shop.access_token_expires_at) {
      const expiry = new Date(shop.access_token_expires_at).getTime();
      const daysLeft = Math.floor((expiry - now) / (24 * 60 * 60 * 1000));
      if (daysLeft <= 7) {
        expiringShops.push({
          name: shop.shop_name || `Seller ${shop.seller_id}`,
          channel: 'Lazada',
          daysLeft,
        });
      }
    }
  });

  if (expiringShops.length === 0) return null;

  const hasExpired = expiringShops.some((s) => s.daysLeft <= 0);
  const hasCritical = expiringShops.some((s) => s.daysLeft > 0 && s.daysLeft <= 3);

  return (
    <Card
      className={cn(
        'border',
        hasExpired || hasCritical
          ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'
          : 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
      )}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              hasExpired || hasCritical ? 'bg-red-100' : 'bg-amber-100'
            )}
          >
            {hasExpired ? (
              <XCircle className="w-5 h-5 text-red-600" />
            ) : hasCritical ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <p
              className={cn(
                'font-semibold',
                hasExpired || hasCritical ? 'text-red-800' : 'text-amber-800'
              )}
            >
              {hasExpired ? 'Token đã hết hạn' : 'Cảnh báo Token'}
            </p>
            <div className="text-sm mt-1 space-y-1">
              {expiringShops.map((shop, i) => (
                <p
                  key={i}
                  className={cn(
                    shop.daysLeft <= 0
                      ? 'text-red-700'
                      : shop.daysLeft <= 3
                        ? 'text-red-600'
                        : 'text-amber-700'
                  )}
                >
                  [{shop.channel}] {shop.name}:{' '}
                  {shop.daysLeft <= 0
                    ? 'Đã hết hạn'
                    : `Còn ${shop.daysLeft} ngày`}
                </p>
              ))}
            </div>
            <Link to="/lazada/shops">
              <Button
                size="sm"
                className={cn(
                  'mt-3 text-white',
                  hasExpired || hasCritical
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-amber-500 hover:bg-amber-600'
                )}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Gia hạn ngay
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { shops: shopeeShops, selectedShopId, isLoading: isShopeeLoading } = useShopeeAuth();
  const { shops: lazadaShops, isLoading: isLazadaLoading } = useLazadaAuth();

  // Inventory summary
  const { summary: inventorySummary, loading: inventoryLoading } = useInventorySummary(
    selectedShopId || 0,
    user?.id || ''
  );

  const isLoading = isShopeeLoading || isLazadaLoading;
  const hasShops = shopeeShops.length > 0 || lazadaShops.length > 0;

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

  // Nếu chưa có shop nào
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
                <Link to="/lazada/shops">
                  <Button className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
                    <LazadaIcon />
                    <span className="ml-2">Kết nối Lazada</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Token Alerts for Admin */}
      <TokenAlerts />

      {/* Inventory Summary */}
      <InventorySummary
        summary={inventorySummary}
        loading={inventoryLoading}
      />
    </div>
  );
}

// Landing Content for non-logged in users
function LandingContent() {
  const features = [
    {
      title: 'Quản lý đa kênh',
      description: 'Kết nối và quản lý Shopee, Lazada trong một nền tảng',
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
