/**
 * Shopee IP Ranges Page - Hiển thị danh sách IP ranges của Shopee
 * Admin only
 */

import { ShopeeIpRangesCard } from '@/components/settings/ShopeeIpRangesCard';

export default function ShopeeIpRangesPage() {
  return (
    <div className="bg-white min-h-full p-4 sm:p-6">
      <ShopeeIpRangesCard />
    </div>
  );
}
