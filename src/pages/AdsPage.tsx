/**
 * Ads Page - Quản lý quảng cáo Shopee Ads
 * Tabs: Chiến dịch (Campaign CRUD) + Hiệu suất (Performance reports)
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { AdsCampaignPanel } from '@/components/panels/AdsCampaignPanel';
import { AdsPerformancePanel } from '@/components/panels/AdsPerformancePanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Store, Megaphone, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdsTab = 'campaigns' | 'performance';

const ADS_TABS: { key: AdsTab; label: string; icon: typeof Megaphone }[] = [
  { key: 'campaigns', label: 'Chiến dịch', icon: Megaphone },
  { key: 'performance', label: 'Hiệu suất', icon: BarChart3 },
];

export default function AdsPage() {
  const { user } = useAuth();
  const { shops, selectedShopId, isLoading } = useShopeeAuth();
  const [activeTab, setActiveTab] = useState<AdsTab>('campaigns');

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
          <a href="/settings/profile" className="text-brand hover:underline font-medium">
            Cài đặt &rarr; Quản lý Shop
          </a>{' '}
          để kết nối shop Shopee.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 bg-card border-b px-4">
        <div className="flex items-center gap-1">
          {ADS_TABS.map(tab => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer',
                  activeTab === tab.key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
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
            {activeTab === 'campaigns' && (
              <AdsCampaignPanel key={`campaigns-${selectedShopId}`} shopId={selectedShopId} />
            )}
            {activeTab === 'performance' && (
              <AdsPerformancePanel key={`performance-${selectedShopId}`} shopId={selectedShopId} />
            )}
          </>
        ) : (
          <div className="p-6">
            <Alert>
              <Store className="h-4 w-4" />
              <AlertDescription>
                Vui lòng chọn shop để xem quảng cáo.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}
