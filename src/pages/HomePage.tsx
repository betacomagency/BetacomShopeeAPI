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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
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

// Token status alert for admin
function TokenAlerts() {
  const { user, profile } = useAuth();
  const { shops: shopeeShops } = useShopeeAuth();

  const isAdmin =
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
    profile?.system_role === 'admin';

  if (!isAdmin) return null;

  // TODO: Add token expiry check for Shopee shops
  return null;
}

export default function HomePage() {
  const { user } = useAuth();
  const { shops: shopeeShops, selectedShopId, isLoading: isShopeeLoading } = useShopeeAuth();
  // Inventory summary
  const { summary: inventorySummary, loading: inventoryLoading } = useInventorySummary(
    selectedShopId || 0,
    user?.id || ''
  );

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
