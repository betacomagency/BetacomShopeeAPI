/**
 * Ads Page - Trang quản lý Quảng cáo Shopee Ads
 */

import { useAuth } from '@/hooks/useAuth';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { AdsCampaignPanel } from '@/components/panels/AdsCampaignPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Store } from 'lucide-react';

export default function AdsPage() {
  const { user } = useAuth();
  const { shops, selectedShopId, isLoading } = useShopeeAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bạn chưa kết nối shop nào. Vui lòng vào{' '}
          <a href="/settings/shops" className="text-orange-500 hover:underline font-medium">
            Cài đặt &rarr; Quản lý Shop
          </a>{' '}
          để kết nối shop Shopee.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      {selectedShopId && user?.id ? (
        <AdsCampaignPanel key={selectedShopId} shopId={selectedShopId} />
      ) : (
        <div className="p-6">
          <Alert>
            <Store className="h-4 w-4" />
            <AlertDescription>
              Vui lòng chọn shop để xem Quảng cáo.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
