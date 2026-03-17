/**
 * Shop Info Page - Trang chi tiết thông tin shop
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ShopInfoContent } from '@/components/profile/ShopInfoContent';

export default function ShopInfoPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();

  const numericShopId = shopId ? parseInt(shopId, 10) : null;

  if (!numericShopId || isNaN(numericShopId)) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-destructive">Shop ID không hợp lệ</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 cursor-pointer"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Quay lại
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card dark:bg-background">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 cursor-pointer text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Quay lại
        </Button>

        <ShopInfoContent
          shopId={numericShopId}
          variant="page"
        />
      </div>
    </div>
  );
}
