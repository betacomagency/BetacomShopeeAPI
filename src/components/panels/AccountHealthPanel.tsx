/**
 * Account Health Panel - Panel hiệu quả hoạt động shop
 */

import { AccountHealthSection } from '@/components/shop-info/AccountHealthSection';

interface AccountHealthPanelProps {
  shopId: number;
}

export function AccountHealthPanel({ shopId }: AccountHealthPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 bg-slate-50 overflow-y-auto p-6">
        <AccountHealthSection shopId={shopId} />
      </div>
    </div>
  );
}
