/**
 * Account Health Panel - Panel hiệu quả hoạt động shop
 */

import { useAccountHealth } from '@/hooks/useAccountHealth';
import { AccountHealthSection } from '@/components/shop-info/AccountHealthSection';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface AccountHealthPanelProps {
  shopId: number;
}

export function AccountHealthPanel({ shopId }: AccountHealthPanelProps) {
  const { isLoading, isError, error, refetch } = useAccountHealth(shopId);

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
          <p className="text-sm text-slate-600 mb-1">Không thể tải hiệu quả hoạt động</p>
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 bg-slate-50 overflow-y-auto p-6">
        <AccountHealthSection shopId={shopId} />
      </div>
    </div>
  );
}
