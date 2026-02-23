/**
 * Shop Info Detail Dialog - Hiển thị chi tiết thông tin shop từ Shopee API
 * Wrapper dialog cho ShopInfoContent
 */

import { ShopInfoContent } from './ShopInfoContent';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShopInfoDetailDialogProps {
  shopId: number | null;
  shopName?: string | null;
  shopLogo?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShopInfoDetailDialog({
  shopId,
  shopName,
  shopLogo,
  open,
  onOpenChange,
}: ShopInfoDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Thông tin Shop</DialogTitle>
          <DialogDescription>Chi tiết thông tin shop từ Shopee API</DialogDescription>
        </DialogHeader>
        <ShopInfoContent
          shopId={shopId}
          initialShopName={shopName}
          initialShopLogo={shopLogo}
          variant="dialog"
        />
      </DialogContent>
    </Dialog>
  );
}
