/**
 * FlashSaleDetailPanel - Display Flash Sale details and manage items
 * Giao diện theo mẫu Shopee Seller Center
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ImageWithZoom } from "@/components/ui/image-with-zoom";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FlashSale } from "@/lib/shopee/flash-sale";
import { getErrorMessage } from "@/lib/shopee/flash-sale";
import { cn } from "@/lib/utils";

interface FlashSaleDetailPanelProps {
  shopId: number;
  flashSale: FlashSale;
  onBack?: () => void;
}

interface FlashSaleItemData {
  item_id: number;
  item_name?: string;
  image?: string;
  image_url?: string;
  item_image?: string;
  status: number;
  purchase_limit: number;
  stock?: number;
  original_price?: number;
  input_promotion_price?: number;
  promotion_price_with_tax?: number;
  campaign_stock?: number;
  models?: Array<{
    model_id: number;
    model_name?: string;
    item_id: number;
    stock: number;
    original_price?: number;
    input_promotion_price?: number;
    promotion_price_with_tax?: number;
    campaign_stock?: number;
    purchase_limit?: number;
    status?: number;
  }>;
}

function getItemImage(item: FlashSaleItemData): string | undefined {
  const imageId = item.image || item.image_url || item.item_image;
  if (!imageId) return undefined;
  if (imageId.startsWith("http")) return imageId;
  return `https://cf.shopee.vn/file/${imageId}`;
}

function formatPrice(price?: number): string {
  if (!price) return "-";
  return `₫${price.toLocaleString("vi-VN")}`;
}

function calcDiscount(original?: number, promo?: number): number {
  if (!original || !promo || original <= 0) return 0;
  return Math.round(((original - promo) / original) * 100);
}

const ITEMS_PER_PAGE = 20;
const COL_COUNT = 7;

function getPageNumbers(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3)
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export function FlashSaleDetailPanel({
  shopId,
  flashSale,
}: FlashSaleDetailPanelProps) {
  const { toast } = useToast();

  const [items, setItems] = useState<FlashSaleItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const fetchItems = async (currentPage: number) => {
    setLoading(true);
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    try {
      const { data, error } = await supabase.functions.invoke(
        "apishopee-flash-sale",
        {
          body: {
            action: "get-items",
            shop_id: shopId,
            flash_sale_id: flashSale.flash_sale_id,
            offset,
            limit: ITEMS_PER_PAGE,
          },
        },
      );

      if (error) throw error;
      if (data?.error) throw new Error(getErrorMessage(data.error));

      const itemInfoList = data?.response?.item_info || [];
      const modelsList = data?.response?.models || [];
      const count = data?.response?.total_count ?? itemInfoList.length;

      const itemsWithModels = itemInfoList.map((item: FlashSaleItemData) => {
        const itemModels = modelsList.filter(
          (m: { item_id: number }) => m.item_id === item.item_id,
        );
        return {
          ...item,
          models: itemModels.length > 0 ? itemModels : undefined,
        };
      });

      setItems(itemsWithModels);
      setTotalCount(count);
      setExpandedItems(new Set());
    } catch (err) {
      toast({
        title: "Lỗi",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchItems(1);
  }, [shopId, flashSale.flash_sale_id]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchItems(newPage);
  };

  const toggleExpand = (itemId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: "75vh" }}>
      {/* Scrollable table area — scrollbar-gutter: stable prevents overlap with dialog X button */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarGutter: "stable" }}>
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead className="bg-slate-50 border-b sticky top-0 z-10">
            <tr>
              <th className="h-11 px-3 text-left align-middle font-medium text-slate-600 text-xs">
                Phân loại hàng
              </th>
              <th className="h-11 px-3 text-right align-middle font-medium text-slate-600 text-xs">
                Giá gốc
              </th>
              <th className="h-11 px-3 text-right align-middle font-medium text-slate-600 text-xs">
                Giá đã giảm
              </th>
              <th className="h-11 px-3 text-center align-middle font-medium text-slate-600 text-xs">
                KM
              </th>
              <th className="h-11 px-3 text-center align-middle font-medium text-slate-600 text-xs leading-tight">
                SL SP
              </th>
              <th className="h-11 px-3 text-center align-middle font-medium text-slate-600 text-xs">
                Kho hàng
              </th>
              <th className="h-11 px-3 text-center align-middle font-medium text-slate-600 text-xs leading-tight">
                Giới hạn
                <br />
                đặt hàng
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COL_COUNT} className="h-48">
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="h-32 text-center text-slate-500">
                  Chưa có sản phẩm nào trong Flash Sale này
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <ItemRow
                  key={item.item_id}
                  item={item}
                  expanded={expandedItems.has(item.item_id)}
                  onToggleExpand={() => toggleExpand(item.item_id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sticky footer: pagination */}
      <div className="flex-shrink-0 border-t px-4 py-3 flex items-center justify-between gap-4 bg-white">
        <span className="text-xs text-slate-400 shrink-0">
          {totalCount > 0
            ? `${totalCount} sản phẩm · Trang ${page}/${totalPages}`
            : ""}
        </span>
        {totalPages > 1 && (
          <Pagination className="justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  className={cn(
                    "cursor-pointer",
                    page === 1 && "pointer-events-none opacity-50",
                  )}
                />
              </PaginationItem>
              {getPageNumbers(page, totalPages).map((p, i) => (
                <PaginationItem key={i}>
                  {p === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      isActive={page === p}
                      onClick={() => handlePageChange(p as number)}
                      className="cursor-pointer">
                      {p}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    handlePageChange(Math.min(totalPages, page + 1))
                  }
                  className={cn(
                    "cursor-pointer",
                    page === totalPages && "pointer-events-none opacity-50",
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}

// Item Row Component
interface ItemRowProps {
  item: FlashSaleItemData;
  expanded: boolean;
  onToggleExpand: () => void;
}

function ItemRow({ item, expanded, onToggleExpand }: ItemRowProps) {
  const hasModels = item.models && item.models.length > 0;
  const modelsToShow = expanded ? item.models : item.models?.slice(0, 5);
  const itemImage = getItemImage(item);

  return (
    <>
      {/* Item Header Row */}
      <tr className="border-b bg-slate-50/50">
        <td colSpan={COL_COUNT} className="px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {itemImage ? (
                <ImageWithZoom
                  src={itemImage}
                  alt={item.item_name || `Item #${item.item_id}`}
                  className="w-full h-full object-cover"
                  zoomSize={240}
                />
              ) : (
                <div className="w-6 h-6 bg-slate-200 rounded" />
              )}
            </div>
            <span className="text-sm font-medium text-slate-700 truncate">
              {item.item_name || `Item #${item.item_id}`}
            </span>
          </div>
        </td>
      </tr>

      {/* Model Rows or Single Item Row */}
      {hasModels ? (
        <>
          {modelsToShow?.map((model) => {
            const promoPrice =
              model.input_promotion_price || model.promotion_price_with_tax;
            const discount = calcDiscount(model.original_price, promoPrice);
            const modelPurchaseLimit =
              model.purchase_limit ?? item.purchase_limit;
            return (
              <tr
                key={model.model_id}
                className="border-b hover:bg-slate-50/50">
                <td className="px-3 py-2">
                  <span className="text-sm text-slate-600 truncate block">
                    {model.model_name || `Model #${model.model_id}`}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-slate-500 text-right">
                  {formatPrice(model.original_price)}
                </td>
                <td className="px-3 py-2 text-sm text-slate-700 text-right font-medium">
                  {formatPrice(promoPrice)}
                </td>
                <td className="px-3 py-2 text-center">
                  {discount > 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-medium text-orange-600 border border-orange-300 rounded">
                      -{discount}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-orange-600 font-medium text-center">
                  {model.campaign_stock ?? 0}
                </td>
                <td className="px-3 py-2 text-sm text-slate-600 text-center">
                  {model.stock ?? 0}
                </td>
                <td className="px-3 py-2 text-sm text-slate-600 text-center">
                  {modelPurchaseLimit > 0 ? modelPurchaseLimit : "-"}
                </td>
              </tr>
            );
          })}
          {/* Expand/Collapse button */}
          {item.models && item.models.length > 5 && (
            <tr className="border-b">
              <td colSpan={COL_COUNT} className="px-3 py-2">
                <button
                  onClick={onToggleExpand}
                  className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer">
                  {expanded ? (
                    <>
                      Thu gọn <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Hiển thị toàn bộ {item.models.length} Phân Loại Hàng{" "}
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </button>
              </td>
            </tr>
          )}
        </>
      ) : (
        <tr className="border-b hover:bg-slate-50/50">
          <td className="px-3 py-2">
            <span className="text-sm text-slate-600">-</span>
          </td>
          <td className="px-3 py-2 text-sm text-slate-500 text-right">
            {formatPrice(item.original_price)}
          </td>
          <td className="px-3 py-2 text-sm text-slate-700 text-right font-medium">
            {formatPrice(
              item.input_promotion_price || item.promotion_price_with_tax,
            )}
          </td>
          <td className="px-3 py-2 text-center">
            {calcDiscount(
              item.original_price,
              item.input_promotion_price || item.promotion_price_with_tax,
            ) > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium text-orange-600 border border-orange-300 rounded">
                -
                {calcDiscount(
                  item.original_price,
                  item.input_promotion_price || item.promotion_price_with_tax,
                )}
                %
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-sm text-orange-600 font-medium text-center">
            {item.campaign_stock ?? 0}
          </td>
          <td className="px-3 py-2 text-sm text-slate-600 text-center">
            {item.stock ?? 0}
          </td>
          <td className="px-3 py-2 text-sm text-slate-600 text-center">
            {item.purchase_limit > 0 ? item.purchase_limit : "-"}
          </td>
        </tr>
      )}
    </>
  );
}

export default FlashSaleDetailPanel;
