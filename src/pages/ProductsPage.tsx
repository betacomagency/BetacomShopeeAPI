/**
 * Products Page - Trang quản lý sản phẩm Shopee
 * Bao gồm: Danh sách sản phẩm và Lịch sử thay đổi
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { ProductsPanel } from '@/components/panels/ProductsPanel';
import { ProductHistoryPanel } from '@/components/panels/ProductHistoryPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Store, Package, History } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tab types
type ProductTab = 'products' | 'history';

const PRODUCT_TABS: { key: ProductTab; label: string; icon: typeof Package }[] = [
  { key: 'products', label: 'Danh sách sản phẩm', icon: Package },
  { key: 'history', label: 'Lịch sử thay đổi', icon: History },
];

export default function ProductsPage() {
  const { user } = useAuth();
  const { shops, selectedShopId, isLoading } = useShopeeAuth();
  const [activeTab, setActiveTab] = useState<ProductTab>('products');

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
            Cài đặt → Quản lý Shop
          </a>{' '}
          để kết nối shop Shopee.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 bg-white border-b px-4">
        <div className="flex items-center gap-1">
          {PRODUCT_TABS.map(tab => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
                  activeTab === tab.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                )}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {selectedShopId && user?.id ? (
          <>
            {activeTab === 'products' && (
              <ProductsPanel key={`products-${selectedShopId}`} shopId={selectedShopId} userId={user.id} />
            )}
            {activeTab === 'history' && (
              <ProductHistoryPanel key={`history-${selectedShopId}`} shopId={selectedShopId} userId={user.id} />
            )}
          </>
        ) : (
          <div className="p-6">
            <Alert>
              <Store className="h-4 w-4" />
              <AlertDescription>
                Vui lòng chọn shop để xem sản phẩm.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}
