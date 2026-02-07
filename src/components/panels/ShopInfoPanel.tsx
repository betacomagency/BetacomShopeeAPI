/**
 * Shop Info Panel - Panel hiển thị thông tin shop
 */

import { useShopInfo } from '@/hooks/useShopInfo';
import { ShopOverviewTab } from '@/components/shop-info/ShopOverviewTab';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ShopInfoPanelProps {
  shopId: number;
  userId: string;
}

export function ShopInfoPanel({ shopId }: ShopInfoPanelProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useShopInfo(shopId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-sm text-slate-600 mb-1">Không thể tải thông tin shop</p>
          <p className="text-xs text-slate-400 mb-4">{error?.message || 'Unknown error'}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-end">
        <div className="flex items-center gap-2">
          {isFetching && !isLoading && (
            <RefreshCw className="w-4 h-4 text-orange-400 animate-spin" />
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-slate-50 overflow-hidden">
        <ShopOverviewTab data={data} shopId={shopId} />
      </div>
    </div>
  );
}
