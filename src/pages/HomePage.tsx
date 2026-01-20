/**
 * Home Page - Dashboard tổng quan cho shop đang chọn
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertCircle,
  ArrowRight,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Star,
  Activity,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { ADMIN_EMAIL } from '@/config/menu-config';

interface ShopDetail {
  id: string;
  shop_id: number;
  shop_name: string;
  shop_logo: string | null;
  region: string;
  expired_at: number | null;
  access_token_expired_at: number | null;
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const { shops, selectedShopId, isLoading: isShopLoading } = useShopeeAuth();
  const [shopDetail, setShopDetail] = useState<ShopDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Kiểm tra admin
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || profile?.system_role === 'admin';

  // Tìm shop đang được chọn từ context
  const currentShop = shops.find((shop) => shop.shop_id === selectedShopId);

  useEffect(() => {
    const abortController = new AbortController();

    if (user?.id && selectedShopId) {
      loadShopDetail(abortController.signal);
    } else if (!isShopLoading) {
      setIsLoading(false);
    }

    return () => {
      abortController.abort();
    };
  }, [user?.id, selectedShopId, isShopLoading]);

  const loadShopDetail = async (signal?: AbortSignal) => {
    if (!user || !selectedShopId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('apishopee_shops')
        .select('id, shop_id, shop_name, shop_logo, region, expired_at, access_token_expired_at')
        .eq('shop_id', selectedShopId)
        .single()
        .abortSignal(signal!);

      if (signal?.aborted) return;

      if (error) {
        if (error.message?.includes('abort')) return;
        console.error('Error loading shop detail:', error);
      } else if (data) {
        setShopDetail(data);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (signal?.aborted) return;
      console.error('Error loading shop detail:', err);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  // Helper: chuẩn hóa timestamp về milliseconds
  const normalizeTimestamp = (ts: number | null): number | null => {
    if (!ts) return null;
    return ts < 1e12 ? ts * 1000 : ts;
  };

  const getTokenStatus = () => {
    if (!shopDetail) return null;

    const now = Date.now();
    const rawExpiry = shopDetail.access_token_expired_at || shopDetail.expired_at;
    const expiry = normalizeTimestamp(rawExpiry);

    if (!expiry) return { status: 'unknown', label: 'Chưa xác thực', color: 'bg-slate-100 text-slate-600', icon: AlertCircle };

    const diffMs = expiry - now;
    const hoursLeft = Math.floor(diffMs / (60 * 60 * 1000));
    const daysLeft = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs <= 0) {
      return { status: 'expired', label: 'Token hết hạn', color: 'bg-red-100 text-red-700', icon: XCircle };
    } else if (daysLeft < 1) {
      return { status: 'critical', label: `Còn ${hoursLeft} giờ`, color: 'bg-red-100 text-red-700', icon: Clock };
    } else if (daysLeft <= 3) {
      return { status: 'critical', label: `Còn ${daysLeft} ngày`, color: 'bg-red-100 text-red-700', icon: Clock };
    } else if (daysLeft <= 7) {
      return { status: 'warning', label: `Còn ${daysLeft} ngày`, color: 'bg-amber-100 text-amber-700', icon: Clock };
    } else {
      return { status: 'active', label: `Còn ${daysLeft} ngày`, color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
    }
  };

  if (isLoading || isShopLoading) {
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
  if (shops.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                <Store className="w-10 h-10 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Chưa có shop nào</h2>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Kết nối shop Shopee của bạn để bắt đầu quản lý đơn hàng, sản phẩm và nhiều hơn nữa
              </p>
              <Link to="/settings/shops">
                <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  <Store className="w-4 h-4 mr-2" />
                  Kết nối Shop Shopee
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tokenStatus = getTokenStatus();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Current Shop Info Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0">
              {currentShop?.shop_logo || shopDetail?.shop_logo ? (
                <img
                  src={currentShop?.shop_logo || shopDetail?.shop_logo || ''}
                  alt={currentShop?.shop_name || shopDetail?.shop_name || 'Shop'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-7 h-7 md:w-8 md:h-8 text-orange-500" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-white">
              <h1 className="text-lg md:text-xl font-bold truncate">
                {currentShop?.shop_name || shopDetail?.shop_name || `Shop ${selectedShopId}`}
              </h1>
              <p className="text-orange-100 text-sm">
                ID: {selectedShopId} • {currentShop?.region || shopDetail?.region || 'VN'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Token Alerts - Chỉ hiển thị cho Admin */}
      {isAdmin && tokenStatus && (tokenStatus.status === 'expired' || tokenStatus.status === 'critical' || tokenStatus.status === 'warning') && (
        <Card className={cn(
          "border",
          tokenStatus.status === 'expired' ? "border-red-200 bg-gradient-to-br from-red-50 to-rose-50" :
          tokenStatus.status === 'critical' ? "border-red-200 bg-gradient-to-br from-red-50 to-rose-50" :
          "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
        )}>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                tokenStatus.status === 'warning' ? "bg-amber-100" : "bg-red-100"
              )}>
                {tokenStatus.status === 'expired' ? (
                  <XCircle className="w-5 h-5 text-red-600" />
                ) : tokenStatus.status === 'critical' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <p className={cn(
                  "font-semibold",
                  tokenStatus.status === 'warning' ? "text-amber-800" : "text-red-800"
                )}>
                  {tokenStatus.status === 'expired' ? 'Token đã hết hạn' :
                   tokenStatus.status === 'critical' ? 'Token sắp hết hạn' : 'Cảnh báo Token'}
                </p>
                <p className={cn(
                  "text-sm mt-1",
                  tokenStatus.status === 'warning' ? "text-amber-700" : "text-red-700"
                )}>
                  {tokenStatus.status === 'expired'
                    ? 'Vui lòng kết nối lại shop để tiếp tục sử dụng'
                    : `Token sẽ hết hạn trong ${tokenStatus.label.replace('Còn ', '')}. Hãy gia hạn ngay!`
                  }
                </p>
                <Link to="/settings/shops">
                  <Button
                    size="sm"
                    className={cn(
                      "mt-3 text-white",
                      tokenStatus.status === 'warning' ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"
                    )}
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    {tokenStatus.status === 'expired' ? 'Kết nối lại' : 'Gia hạn ngay'}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Truy cập nhanh
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <QuickActionButton icon={Package} label="Quản lý sản phẩm" href="/products" color="blue" />
            <QuickActionButton icon={ShoppingCart} label="Quản lý đơn hàng" href="/orders" color="emerald" />
            <QuickActionButton icon={Star} label="Đánh giá" href="/reviews" color="amber" />
            <QuickActionButton icon={Zap} label="Flash Sale" href="/flash-sale" color="orange" />
            <QuickActionButton icon={Store} label="Quản lý Shop" href="/settings/shops" color="purple" />
            <QuickActionButton icon={TrendingUp} label="Quảng cáo" href="/ads" color="pink" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Quick Action Button
function QuickActionButton({
  icon: Icon,
  label,
  href,
  color
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: 'blue' | 'emerald' | 'amber' | 'orange' | 'purple' | 'pink';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
    orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
    pink: 'bg-pink-50 text-pink-600 group-hover:bg-pink-100',
  };

  return (
    <Link to={href}>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
        <div className={cn("p-2 rounded-lg transition-colors", colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-medium text-slate-700 group-hover:text-slate-900 flex-1">{label}</span>
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

// Landing Content for non-logged in users
function LandingContent() {
  const features = [
    {
      title: 'Quản lý đa Shop',
      description: 'Kết nối và quản lý nhiều shop Shopee cùng lúc',
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
          Nền tảng quản lý Shop Shopee chuyên nghiệp, giúp bạn tối ưu hóa kinh doanh
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6">
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} mb-4`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center">
        <Link to="/auth">
          <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8">
            Đăng nhập để bắt đầu
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
