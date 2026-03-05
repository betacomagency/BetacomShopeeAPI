/**
 * Flash Sale Overview Page - Admin only
 * Xem tổng quan Flash Sale của tất cả shop
 */

import { useAuth } from '@/hooks/useAuth';
import { AllShopsFlashSalePanel } from '@/components/panels/AllShopsFlashSalePanel';
import { Spinner } from '@/components/ui/spinner';

export default function FlashSaleOverviewPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user?.id) {
    return null;
  }

  return <AllShopsFlashSalePanel userId={user.id} />;
}
