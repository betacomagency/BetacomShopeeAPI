/**
 * OrderDetailPage - Trang chi tiết đơn hàng giống Shopee Seller Center
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, Package, Truck, MapPin,
  Clock, AlertCircle, RefreshCw, FileText, CreditCard, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ImageWithZoom } from '@/components/ui/image-with-zoom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Order as ShopeeOrder, OrderItem } from '@/hooks/useOrdersData';

// ==================== ESCROW INTERFACES ====================

interface EscrowItem {
  item_id: number;
  item_name: string;
  item_sku?: string;
  model_id: number;
  model_name?: string;
  model_sku?: string;
  original_price: number;
  selling_price: number;
  discounted_price: number;
  seller_discount: number;
  shopee_discount: number;
  discount_from_coin: number;
  discount_from_voucher_shopee: number;
  discount_from_voucher_seller: number;
  quantity_purchased: number;
  activity_type?: string;
  activity_id?: number;
  is_main_item?: boolean;
  is_b2c_shop_item?: boolean;
  ams_commission_fee?: number;
  promotion_list?: { promotion_type: string; promotion_id: number }[];
}

interface OrderAdjustment {
  amount: number;
  date: number;
  currency: string;
  adjustment_reason?: string;
}

interface OrderIncome {
  // Giá trị chính
  escrow_amount: number;
  escrow_amount_after_adjustment?: number;
  buyer_total_amount: number;
  original_price?: number;
  order_original_price?: number;
  order_discounted_price?: number;
  order_selling_price?: number;
  order_seller_discount?: number;
  seller_discount?: number;
  shopee_discount?: number;
  original_shopee_discount?: number;
  voucher_from_seller?: number;
  voucher_from_shopee?: number;
  coins?: number;

  // Phí vận chuyển
  buyer_paid_shipping_fee?: number;
  buyer_transaction_fee?: number;
  estimated_shipping_fee?: number;
  final_shipping_fee?: number;
  actual_shipping_fee?: number;
  shopee_shipping_rebate?: number;
  shipping_fee_discount_from_3pl?: number;
  seller_shipping_discount?: number;
  reverse_shipping_fee?: number;
  shipping_fee_sst?: number;
  reverse_shipping_fee_sst?: number;

  // Phí dịch vụ & hoa hồng
  commission_fee?: number;
  service_fee?: number;
  seller_transaction_fee?: number;
  campaign_fee?: number;
  order_ams_commission_fee?: number;
  credit_card_promotion?: number;
  credit_card_transaction_fee?: number;
  payment_promotion?: number;
  net_commission_fee?: number;
  net_service_fee?: number;
  seller_order_processing_fee?: number;
  fbs_fee?: number;

  // Thuế
  escrow_tax?: number;
  final_product_vat_tax?: number;
  final_shipping_vat_tax?: number;
  final_escrow_product_gst?: number;
  final_escrow_shipping_gst?: number;
  withholding_tax?: number;
  withholding_vat_tax?: number;
  withholding_pit_tax?: number;
  cross_border_tax?: number;
  sales_tax_on_lvg?: number;
  vat_on_imported_goods?: number;

  // Bồi thường & hoàn trả
  seller_lost_compensation?: number;
  seller_coin_cash_back?: number;
  seller_return_refund?: number;
  drc_adjustable_refund?: number;
  cost_of_goods_sold?: number;
  original_cost_of_goods_sold?: number;
  final_product_protection?: number;

  // Bảo hiểm & phí bổ sung
  rsf_seller_protection_fee_claim_amount?: number;
  shipping_seller_protection_fee_amount?: number;
  delivery_seller_protection_fee_premium_amount?: number;
  overseas_return_service_fee?: number;

  // Điều chỉnh
  total_adjustment_amount?: number;
  order_adjustment?: OrderAdjustment[];

  // Thông tin thanh toán
  buyer_payment_method?: string;
  instalment_plan?: string;
  seller_voucher_code?: string[];

  // Items
  items?: EscrowItem[];
}

interface BuyerPaymentInfo {
  buyer_payment_method?: string;
  buyer_total_amount?: number;
  merchant_subtotal?: number;
  shipping_fee?: number;
  seller_voucher?: number;
  shopee_voucher?: number;
  shopee_coins_redeemed?: number;
  credit_card_promotion?: number;
  insurance_premium?: number;
  buyer_service_fee?: number;
  buyer_tax_amount?: number;
  is_paid_by_credit_card?: boolean;
}

interface EscrowData {
  order_sn: string;
  buyer_user_name?: string;
  return_order_sn_list?: string[];
  order_income: OrderIncome;
  buyer_payment_info?: BuyerPaymentInfo;
}

// ==================== CONSTANTS ====================

const FULL_OPTIONAL_FIELDS = [
  'buyer_user_id', 'buyer_username', 'estimated_shipping_fee',
  'recipient_address', 'actual_shipping_fee', 'goods_to_declare',
  'note', 'note_update_time', 'item_list', 'pay_time',
  'dropshipper', 'dropshipper_phone', 'split_up',
  'buyer_cancel_reason', 'cancel_by', 'cancel_reason',
  'actual_shipping_fee_confirmed', 'buyer_cpf_id',
  'fulfillment_flag', 'pickup_done_time', 'package_list',
  'shipping_carrier', 'payment_method', 'total_amount',
  'invoice_data', 'order_chargeable_weight_gram',
  'return_request_due_date', 'edt', 'payment_info'
].join(',');

const STATUS_STYLES: Record<string, { label: string; color: string; borderColor: string }> = {
  UNPAID: { label: 'Chờ thanh toán', color: 'text-yellow-700', borderColor: 'border-l-yellow-500' },
  READY_TO_SHIP: { label: 'Chờ lấy hàng', color: 'text-orange-600', borderColor: 'border-l-orange-500' },
  PROCESSED: { label: 'Đang xử lý', color: 'text-blue-700', borderColor: 'border-l-blue-500' },
  SHIPPED: { label: 'Đang giao', color: 'text-purple-700', borderColor: 'border-l-purple-500' },
  COMPLETED: { label: 'Hoàn thành', color: 'text-green-700', borderColor: 'border-l-green-500' },
  IN_CANCEL: { label: 'Đang hủy', color: 'text-orange-700', borderColor: 'border-l-orange-500' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-700', borderColor: 'border-l-red-500' },
};

// ==================== UTILITIES ====================

function formatPrice(price: number | undefined | null, currency?: string): string {
  if (price === undefined || price === null) return '₫0';
  if (currency === 'VND' || !currency) {
    return '₫' + new Intl.NumberFormat('vi-VN').format(price);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
}

function formatDateTime(ts: number | undefined): string {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function maskText(text: string | undefined, keepFirst = 1, keepLast = 1): string {
  if (!text || text.length <= keepFirst + keepLast) return text || '';
  return text.slice(0, keepFirst) + '*'.repeat(Math.min(text.length - keepFirst - keepLast, 5)) + text.slice(-keepLast);
}

// ==================== SUB COMPONENTS ====================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="ml-1 text-slate-400 hover:text-slate-600 transition-colors">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function SectionCard({ icon: Icon, title, children, iconColor = "text-orange-500" }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Helper component cho Financial Row
function FinanceRow({
  label,
  value,
  currency,
  isHeader = false,
  isNegative = false,
  isTotal = false,
}: {
  label: string;
  value: number | undefined | null;
  currency?: string;
  isHeader?: boolean;
  isNegative?: boolean;
  isTotal?: boolean;
}) {
  // Không hiển thị nếu value = 0 hoặc undefined (trừ header)
  if (!isHeader && (value === undefined || value === null || value === 0)) return null;

  const displayValue = value || 0;
  const formattedValue = formatPrice(Math.abs(displayValue), currency);

  return (
    <div className={cn(
      "flex justify-end gap-6",
      isHeader ? "py-1.5" : "py-1",
      isTotal && "py-3 mt-3 border-t border-slate-200"
    )}>
      <span className={cn(
        "text-right",
        isHeader || isTotal ? "text-slate-700 font-medium" : "text-slate-500"
      )}>
        {label}
      </span>
      <span className={cn(
        "w-24 text-right",
        isTotal ? "text-lg font-bold text-orange-500" :
        isNegative && displayValue !== 0 ? "text-red-600" :
        isHeader ? "text-slate-700" : "text-slate-500"
      )}>
        {isNegative && displayValue !== 0 ? `-${formattedValue}` : formattedValue}
      </span>
    </div>
  );
}

// Component render động Financial Summary từ Escrow Data
function EscrowFinancialSummary({
  escrowData,
  order,
  items,
  currency,
}: {
  escrowData: EscrowData | null;
  order: ShopeeOrder;
  items: OrderItem[];
  currency?: string;
}) {
  const income = escrowData?.order_income;
  const isCancelled = order.order_status === 'CANCELLED' || order.order_status === 'IN_CANCEL';

  // Tính tổng giá sản phẩm
  const productTotal = income?.order_selling_price
    || income?.order_discounted_price
    || items.reduce((sum, item) => sum + (item.model_discounted_price * item.model_quantity_purchased), 0)
    || order.total_amount;

  // Tính các nhóm phí
  const shippingFees = [
    { key: 'buyer_paid_shipping_fee', label: 'Phí vận chuyển Người mua trả', value: income?.buyer_paid_shipping_fee },
    { key: 'estimated_shipping_fee', label: 'Phí vận chuyển ước tính', value: income?.estimated_shipping_fee },
    { key: 'final_shipping_fee', label: 'Phí vận chuyển cuối cùng', value: income?.final_shipping_fee },
    { key: 'actual_shipping_fee', label: 'Phí vận chuyển thực tế', value: income?.actual_shipping_fee, isNegative: true },
    { key: 'shopee_shipping_rebate', label: 'Hỗ trợ vận chuyển Shopee', value: income?.shopee_shipping_rebate },
    { key: 'shipping_fee_discount_from_3pl', label: 'Giảm giá từ 3PL', value: income?.shipping_fee_discount_from_3pl },
    { key: 'seller_shipping_discount', label: 'Giảm giá vận chuyển từ Seller', value: income?.seller_shipping_discount },
    { key: 'reverse_shipping_fee', label: 'Phí vận chuyển hoàn', value: income?.reverse_shipping_fee, isNegative: true },
    { key: 'shipping_fee_sst', label: 'SST vận chuyển', value: income?.shipping_fee_sst },
    { key: 'reverse_shipping_fee_sst', label: 'SST vận chuyển hoàn', value: income?.reverse_shipping_fee_sst },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== 0);

  const shippingTotal = (income?.buyer_paid_shipping_fee || 0) -
    (income?.actual_shipping_fee || 0) -
    (income?.reverse_shipping_fee || 0) +
    (income?.shopee_shipping_rebate || 0) +
    (income?.shipping_fee_discount_from_3pl || 0);

  // Phụ phí (fees)
  const serviceFees = [
    { key: 'commission_fee', label: 'Phí cố định (hoa hồng)', value: income?.commission_fee },
    { key: 'service_fee', label: 'Phí Dịch vụ', value: income?.service_fee },
    { key: 'seller_transaction_fee', label: 'Phí thanh toán', value: income?.seller_transaction_fee },
    { key: 'campaign_fee', label: 'Phí chiến dịch', value: income?.campaign_fee },
    { key: 'order_ams_commission_fee', label: 'Phí affiliate (AMS)', value: income?.order_ams_commission_fee },
    { key: 'credit_card_transaction_fee', label: 'Phí giao dịch thẻ tín dụng', value: income?.credit_card_transaction_fee },
    { key: 'seller_order_processing_fee', label: 'Phí xử lý đơn hàng', value: income?.seller_order_processing_fee },
    { key: 'fbs_fee', label: 'Phí FBS', value: income?.fbs_fee },
    { key: 'net_commission_fee', label: 'Phí hoa hồng ròng', value: income?.net_commission_fee },
    { key: 'net_service_fee', label: 'Phí dịch vụ ròng', value: income?.net_service_fee },
    { key: 'overseas_return_service_fee', label: 'Phí hoàn hàng quốc tế', value: income?.overseas_return_service_fee },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== 0);

  const feeTotal = serviceFees.reduce((sum, f) => sum + (f.value || 0), 0);

  // Thuế
  const taxes = [
    { key: 'withholding_vat_tax', label: 'Thuế GTGT khấu trừ', value: income?.withholding_vat_tax },
    { key: 'withholding_pit_tax', label: 'Thuế TNCN', value: income?.withholding_pit_tax },
    { key: 'withholding_tax', label: 'Thuế khấu trừ', value: income?.withholding_tax },
    { key: 'escrow_tax', label: 'Thuế Escrow', value: income?.escrow_tax },
    { key: 'final_product_vat_tax', label: 'Thuế GTGT (sản phẩm)', value: income?.final_product_vat_tax },
    { key: 'final_shipping_vat_tax', label: 'Thuế GTGT (vận chuyển)', value: income?.final_shipping_vat_tax },
    { key: 'final_escrow_product_gst', label: 'GST (sản phẩm)', value: income?.final_escrow_product_gst },
    { key: 'final_escrow_shipping_gst', label: 'GST (vận chuyển)', value: income?.final_escrow_shipping_gst },
    { key: 'cross_border_tax', label: 'Thuế xuyên biên giới', value: income?.cross_border_tax },
    { key: 'sales_tax_on_lvg', label: 'Thuế bán hàng LVG', value: income?.sales_tax_on_lvg },
    { key: 'vat_on_imported_goods', label: 'VAT hàng nhập khẩu', value: income?.vat_on_imported_goods },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== 0);

  const taxTotal = taxes.reduce((sum, f) => sum + (f.value || 0), 0);

  // Khuyến mãi & Voucher
  const discounts = [
    { key: 'seller_discount', label: 'Giảm giá từ Seller', value: income?.seller_discount },
    { key: 'shopee_discount', label: 'Giảm giá từ Shopee', value: income?.shopee_discount },
    { key: 'voucher_from_seller', label: 'Voucher Seller', value: income?.voucher_from_seller },
    { key: 'voucher_from_shopee', label: 'Voucher Shopee', value: income?.voucher_from_shopee },
    { key: 'coins', label: 'Shopee Coins', value: income?.coins },
    { key: 'credit_card_promotion', label: 'Khuyến mãi thẻ tín dụng', value: income?.credit_card_promotion },
    { key: 'payment_promotion', label: 'Khuyến mãi thanh toán', value: income?.payment_promotion },
    { key: 'seller_coin_cash_back', label: 'Coin cashback từ Seller', value: income?.seller_coin_cash_back },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== 0);

  const discountTotal = discounts.reduce((sum, f) => sum + (f.value || 0), 0);

  // Bồi thường & Hoàn trả
  const refunds = [
    { key: 'seller_lost_compensation', label: 'Bồi thường mất hàng', value: income?.seller_lost_compensation, isPositive: true },
    { key: 'seller_return_refund', label: 'Hoàn trả cho Seller', value: income?.seller_return_refund, isPositive: true },
    { key: 'drc_adjustable_refund', label: 'Hoàn tiền DRC', value: income?.drc_adjustable_refund },
    { key: 'final_product_protection', label: 'Bảo vệ sản phẩm', value: income?.final_product_protection },
    { key: 'rsf_seller_protection_fee_claim_amount', label: 'Bồi thường phí bảo vệ', value: income?.rsf_seller_protection_fee_claim_amount },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== 0);

  // Dịch vụ giá trị gia tăng cho người mua
  const buyerVAS = escrowData?.buyer_payment_info ? [
    { key: 'insurance_premium', label: 'Phí bảo hiểm', value: escrowData.buyer_payment_info.insurance_premium },
    { key: 'buyer_service_fee', label: 'Phí dịch vụ người mua', value: escrowData.buyer_payment_info.buyer_service_fee },
    { key: 'buyer_tax_amount', label: 'Thuế người mua', value: escrowData.buyer_payment_info.buyer_tax_amount },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== 0) : [];

  const vasTotal = buyerVAS.reduce((sum, f) => sum + (f.value || 0), 0);

  // Final escrow amount - nếu đơn hủy thì = 0
  const escrowAmount = isCancelled ? 0 : (income?.escrow_amount_after_adjustment || income?.escrow_amount || order.total_amount);

  return (
    <div className="text-sm">
      {/* Tổng tiền sản phẩm */}
      <FinanceRow label="Tổng tiền sản phẩm" value={isCancelled ? 0 : productTotal} currency={currency} isHeader />
      {income?.order_original_price && income.order_original_price !== productTotal && (
        <FinanceRow label="Giá gốc sản phẩm" value={income.order_original_price} currency={currency} />
      )}
      <FinanceRow label="Giá sản phẩm" value={productTotal} currency={currency} />
      {/* Số tiền đã hủy - chỉ hiển thị khi đơn bị hủy */}
      {isCancelled && productTotal > 0 && (
        <FinanceRow label="Số tiền đã hủy" value={productTotal} currency={currency} isNegative />
      )}

      {/* Tổng phí vận chuyển */}
      {shippingFees.length > 0 && (
        <div className="mt-2">
          <FinanceRow label="Tổng phí vận chuyển ước tính" value={shippingTotal} currency={currency} isHeader />
          {shippingFees.map(f => (
            <FinanceRow key={f.key} label={f.label} value={f.value} currency={currency} isNegative={f.isNegative} />
          ))}
        </div>
      )}

      {/* Phụ phí */}
      {serviceFees.length > 0 && (
        <div className="mt-2">
          <FinanceRow label="Phụ phí" value={feeTotal} currency={currency} isHeader isNegative />
          {serviceFees.map(f => (
            <FinanceRow key={f.key} label={f.label} value={f.value} currency={currency} isNegative />
          ))}
        </div>
      )}

      {/* Thuế */}
      {taxes.length > 0 && (
        <div className="mt-2">
          <FinanceRow label="Thuế" value={taxTotal} currency={currency} isHeader isNegative />
          {taxes.map(f => (
            <FinanceRow key={f.key} label={f.label} value={f.value} currency={currency} isNegative />
          ))}
        </div>
      )}

      {/* Khuyến mãi & Giảm giá (nếu có) */}
      {discounts.length > 0 && (
        <div className="mt-2">
          <FinanceRow label="Khuyến mãi & Voucher" value={discountTotal} currency={currency} isHeader isNegative />
          {discounts.map(f => (
            <FinanceRow key={f.key} label={f.label} value={f.value} currency={currency} isNegative />
          ))}
        </div>
      )}

      {/* Bồi thường & Hoàn trả (nếu có) */}
      {refunds.length > 0 && (
        <div className="mt-2">
          <FinanceRow label="Bồi thường & Hoàn trả" value={null} currency={currency} isHeader />
          {refunds.map(f => (
            <FinanceRow key={f.key} label={f.label} value={f.value} currency={currency} isNegative={!f.isPositive} />
          ))}
        </div>
      )}

      {/* Dịch vụ giá trị gia tăng cho người mua */}
      <div className="mt-2">
        <FinanceRow label="Tổng phụ dịch vụ giá trị gia tăng cho người mua" value={vasTotal} currency={currency} isHeader />
        {buyerVAS.map(f => (
          <FinanceRow key={f.key} label={f.label} value={f.value} currency={currency} />
        ))}
      </div>

      {/* Điều chỉnh (nếu có) */}
      {income?.order_adjustment && income.order_adjustment.length > 0 && (
        <div className="mt-2">
          <FinanceRow label="Điều chỉnh" value={income.total_adjustment_amount} currency={currency} isHeader />
          {income.order_adjustment.map((adj, idx) => (
            <FinanceRow
              key={idx}
              label={adj.adjustment_reason || `Điều chỉnh ${idx + 1}`}
              value={adj.amount}
              currency={adj.currency || currency}
              isNegative={adj.amount < 0}
            />
          ))}
        </div>
      )}

      {/* Doanh thu đơn hàng ước tính */}
      <FinanceRow label="Doanh thu đơn hàng ước tính" value={escrowAmount} currency={currency} isTotal />
    </div>
  );
}

// Component render động Buyer Payment Summary
function BuyerPaymentSummary({
  buyerPaymentInfo,
  orderIncome,
  order,
  currency,
}: {
  buyerPaymentInfo?: BuyerPaymentInfo;
  orderIncome?: OrderIncome;
  order: ShopeeOrder;
  currency?: string;
}) {
  // Build danh sách các dòng cần hiển thị
  const paymentRows = [
    { key: 'merchant_subtotal', label: 'Tổng tiền sản phẩm', value: buyerPaymentInfo?.merchant_subtotal || orderIncome?.order_selling_price || order.total_amount },
    { key: 'shipping_fee', label: 'Phí vận chuyển', value: buyerPaymentInfo?.shipping_fee || orderIncome?.buyer_paid_shipping_fee },
    { key: 'shopee_voucher', label: 'Shopee Voucher', value: buyerPaymentInfo?.shopee_voucher || orderIncome?.voucher_from_shopee, isNegative: true },
    { key: 'seller_voucher', label: 'Mã giảm giá của Shop', value: buyerPaymentInfo?.seller_voucher || orderIncome?.voucher_from_seller, isNegative: true },
    { key: 'shopee_coins', label: 'Shopee Coins', value: buyerPaymentInfo?.shopee_coins_redeemed || orderIncome?.coins, isNegative: true },
    { key: 'credit_card_promotion', label: 'Khuyến mãi thẻ tín dụng', value: buyerPaymentInfo?.credit_card_promotion, isNegative: true },
    { key: 'insurance_premium', label: 'Phí bảo hiểm', value: buyerPaymentInfo?.insurance_premium },
    { key: 'buyer_service_fee', label: 'Phí dịch vụ', value: buyerPaymentInfo?.buyer_service_fee },
    { key: 'buyer_tax_amount', label: 'Thuế', value: buyerPaymentInfo?.buyer_tax_amount },
  ];

  // Lọc ra những dòng có giá trị
  const visibleRows = paymentRows.filter(r => r.value !== undefined && r.value !== null && r.value !== 0);

  const totalPayment = buyerPaymentInfo?.buyer_total_amount || orderIncome?.buyer_total_amount || order.total_amount;

  return (
    <>
      {visibleRows.map(row => (
        <div key={row.key} className="flex justify-end gap-6 py-1.5">
          <span className="text-slate-500 text-right">{row.label}</span>
          <span className={cn("w-24 text-right", row.isNegative && row.value ? "text-slate-500" : "text-slate-500")}>
            {row.isNegative && row.value ? `-${formatPrice(Math.abs(row.value), currency)}` : formatPrice(row.value, currency)}
          </span>
        </div>
      ))}
      <div className="flex justify-end gap-6 py-2 mt-2 border-t border-slate-200">
        <span className="text-slate-700 font-medium text-right">Tổng tiền Thanh toán</span>
        <span className="text-orange-500 font-bold w-24 text-right">{formatPrice(totalPayment, currency)}</span>
      </div>
      {buyerPaymentInfo?.buyer_payment_method && (
        <div className="flex justify-end gap-6 py-1 text-xs">
          <span className="text-slate-400">Phương thức: {buyerPaymentInfo.buyer_payment_method}</span>
        </div>
      )}
    </>
  );
}

// ==================== MAIN COMPONENT ====================

export default function OrderDetailPage() {
  const { orderSn } = useParams<{ orderSn: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedShopId } = useShopeeAuth();

  const [order, setOrder] = useState<ShopeeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [escrowData, setEscrowData] = useState<EscrowData | null>(null);
  const [loadingEscrow, setLoadingEscrow] = useState(false);

  // Fetch order detail
  const fetchOrderDetail = useCallback(async () => {
    if (!selectedShopId || !orderSn) return;

    setLoading(true);
    setError(null);

    try {
      const res = await supabase.functions.invoke('apishopee-proxy', {
        body: {
          api_path: '/api/v2/order/get_order_detail',
          method: 'GET',
          shop_id: selectedShopId,
          params: {
            order_sn_list: orderSn,
            response_optional_fields: FULL_OPTIONAL_FIELDS,
            request_order_status_pending: 'true',
          },
        },
      });

      if (res.error) throw res.error;

      const orderList = res.data?.response?.data?.response?.order_list;
      if (orderList && orderList.length > 0) {
        setOrder(orderList[0]);
      } else {
        setError('Không tìm thấy đơn hàng');
      }
    } catch (err) {
      setError((err as Error).message);
      toast({ title: 'Lỗi', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedShopId, orderSn, toast]);

  // Fetch escrow data - First try from database, then API
  const fetchEscrowData = useCallback(async () => {
    if (!selectedShopId || !orderSn) return;

    setLoadingEscrow(true);
    try {
      // Step 1: Try to get escrow from database first
      const dbRes = await supabase.functions.invoke('apishopee-orders-sync', {
        body: {
          action: 'get-escrow',
          shop_id: selectedShopId,
          order_sn: orderSn,
        },
      });

      if (dbRes.data?.success && dbRes.data?.escrow) {
        // Found in database - convert DB format to EscrowData format
        const dbEscrow = dbRes.data.escrow;
        const escrowFromDb: EscrowData = {
          order_sn: dbEscrow.order_sn,
          buyer_user_name: dbEscrow.buyer_user_name,
          return_order_sn_list: dbEscrow.return_order_sn_list || [],
          order_income: {
            escrow_amount: dbEscrow.escrow_amount,
            escrow_amount_after_adjustment: dbEscrow.escrow_amount_after_adjustment,
            buyer_total_amount: dbEscrow.buyer_total_amount,
            original_price: dbEscrow.original_price,
            order_original_price: dbEscrow.order_original_price,
            order_discounted_price: dbEscrow.order_discounted_price,
            order_selling_price: dbEscrow.order_selling_price,
            order_seller_discount: dbEscrow.order_seller_discount,
            seller_discount: dbEscrow.seller_discount,
            shopee_discount: dbEscrow.shopee_discount,
            original_shopee_discount: dbEscrow.original_shopee_discount,
            voucher_from_seller: dbEscrow.voucher_from_seller,
            voucher_from_shopee: dbEscrow.voucher_from_shopee,
            coins: dbEscrow.coins,
            buyer_paid_shipping_fee: dbEscrow.buyer_paid_shipping_fee,
            buyer_transaction_fee: dbEscrow.buyer_transaction_fee,
            estimated_shipping_fee: dbEscrow.estimated_shipping_fee,
            final_shipping_fee: dbEscrow.final_shipping_fee,
            actual_shipping_fee: dbEscrow.actual_shipping_fee,
            shopee_shipping_rebate: dbEscrow.shopee_shipping_rebate,
            shipping_fee_discount_from_3pl: dbEscrow.shipping_fee_discount_from_3pl,
            seller_shipping_discount: dbEscrow.seller_shipping_discount,
            reverse_shipping_fee: dbEscrow.reverse_shipping_fee,
            shipping_fee_sst: dbEscrow.shipping_fee_sst,
            reverse_shipping_fee_sst: dbEscrow.reverse_shipping_fee_sst,
            commission_fee: dbEscrow.commission_fee,
            service_fee: dbEscrow.service_fee,
            seller_transaction_fee: dbEscrow.seller_transaction_fee,
            campaign_fee: dbEscrow.campaign_fee,
            order_ams_commission_fee: dbEscrow.order_ams_commission_fee,
            credit_card_promotion: dbEscrow.credit_card_promotion,
            credit_card_transaction_fee: dbEscrow.credit_card_transaction_fee,
            payment_promotion: dbEscrow.payment_promotion,
            net_commission_fee: dbEscrow.net_commission_fee,
            net_service_fee: dbEscrow.net_service_fee,
            seller_order_processing_fee: dbEscrow.seller_order_processing_fee,
            fbs_fee: dbEscrow.fbs_fee,
            escrow_tax: dbEscrow.escrow_tax,
            final_product_vat_tax: dbEscrow.final_product_vat_tax,
            final_shipping_vat_tax: dbEscrow.final_shipping_vat_tax,
            final_escrow_product_gst: dbEscrow.final_escrow_product_gst,
            final_escrow_shipping_gst: dbEscrow.final_escrow_shipping_gst,
            withholding_tax: dbEscrow.withholding_tax,
            withholding_vat_tax: dbEscrow.withholding_vat_tax,
            withholding_pit_tax: dbEscrow.withholding_pit_tax,
            cross_border_tax: dbEscrow.cross_border_tax,
            sales_tax_on_lvg: dbEscrow.sales_tax_on_lvg,
            vat_on_imported_goods: dbEscrow.vat_on_imported_goods,
            seller_lost_compensation: dbEscrow.seller_lost_compensation,
            seller_coin_cash_back: dbEscrow.seller_coin_cash_back,
            seller_return_refund: dbEscrow.seller_return_refund,
            drc_adjustable_refund: dbEscrow.drc_adjustable_refund,
            cost_of_goods_sold: dbEscrow.cost_of_goods_sold,
            original_cost_of_goods_sold: dbEscrow.original_cost_of_goods_sold,
            final_product_protection: dbEscrow.final_product_protection,
            rsf_seller_protection_fee_claim_amount: dbEscrow.rsf_seller_protection_fee_claim_amount,
            shipping_seller_protection_fee_amount: dbEscrow.shipping_seller_protection_fee_amount,
            delivery_seller_protection_fee_premium_amount: dbEscrow.delivery_seller_protection_fee_premium_amount,
            overseas_return_service_fee: dbEscrow.overseas_return_service_fee,
            total_adjustment_amount: dbEscrow.total_adjustment_amount,
            order_adjustment: dbEscrow.order_adjustment || [],
            buyer_payment_method: dbEscrow.buyer_payment_method,
            instalment_plan: dbEscrow.instalment_plan,
            seller_voucher_code: dbEscrow.seller_voucher_code || [],
            items: dbEscrow.items || [],
          },
          buyer_payment_info: {
            buyer_payment_method: dbEscrow.buyer_payment_info_method,
            buyer_total_amount: dbEscrow.buyer_payment_info_total_amount,
            merchant_subtotal: dbEscrow.merchant_subtotal,
            shipping_fee: dbEscrow.buyer_shipping_fee,
            seller_voucher: dbEscrow.buyer_seller_voucher,
            shopee_voucher: dbEscrow.buyer_shopee_voucher,
            shopee_coins_redeemed: dbEscrow.shopee_coins_redeemed,
            credit_card_promotion: dbEscrow.buyer_credit_card_promotion,
            insurance_premium: dbEscrow.insurance_premium,
            buyer_service_fee: dbEscrow.buyer_service_fee,
            buyer_tax_amount: dbEscrow.buyer_tax_amount,
            is_paid_by_credit_card: dbEscrow.is_paid_by_credit_card,
          },
        };
        setEscrowData(escrowFromDb);
        return;
      }

      // Step 2: Not in database, fetch from API
      const res = await supabase.functions.invoke('apishopee-proxy', {
        body: {
          api_path: '/api/v2/payment/get_escrow_detail',
          method: 'GET',
          shop_id: selectedShopId,
          params: { order_sn: orderSn },
        },
      });

      if (res.error) throw res.error;
      const data = res.data?.response?.data?.response;
      if (data) {
        setEscrowData(data);

        // Step 3: Save to database for future use (fire and forget)
        supabase.functions.invoke('apishopee-orders-sync', {
          body: {
            action: 'sync-escrow',
            shop_id: selectedShopId,
            order_sns: [orderSn],
          },
        }).catch(() => {
          // Silently fail - not critical
        });
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingEscrow(false);
    }
  }, [selectedShopId, orderSn]);

  useEffect(() => {
    fetchOrderDetail();
    fetchEscrowData();
  }, [fetchOrderDetail, fetchEscrowData]);

  if (!selectedShopId || !user?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
        <p className="text-slate-500">Vui lòng chọn shop để xem chi tiết đơn hàng</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-red-300 mb-4" />
        <p className="text-red-500 mb-4">{error || 'Không tìm thấy đơn hàng'}</p>
        <Button variant="outline" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>
      </div>
    );
  }

  const status = STATUS_STYLES[order.order_status] || { label: order.order_status, color: 'text-gray-700', borderColor: 'border-l-gray-500' };
  const items = order.item_list || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Main 2-column layout */}
        <div className="flex gap-4">
          {/* LEFT COLUMN - Main Content */}
          <div className="flex-1 space-y-4">
            {/* Status Banner */}
            <div className={cn("bg-white rounded-lg shadow-sm border-l-4 p-4", status.borderColor)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className={cn("h-5 w-5", status.color)} />
                    <span className={cn("text-sm font-semibold", status.color)}>{status.label}</span>
                    <button className="text-slate-400 hover:text-slate-600">
                      <AlertCircle className="h-4 w-4" />
                    </button>
                  </div>
                  {order.order_status === 'READY_TO_SHIP' && order.ship_by_date && (
                    <p className="text-sm text-slate-500">
                      Để tránh việc giao hàng trễ, vui lòng giao hàng/chuẩn bị hàng trước {formatDateTime(order.ship_by_date)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Combined Order Info Card */}
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Mã đơn hàng */}
              <div className="px-4 py-3 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-slate-800">Mã đơn hàng</span>
                </div>
                <div className="flex items-center pl-6">
                  <span className="text-sm text-orange-500 font-medium">{order.order_sn}</span>
                  <CopyButton text={order.order_sn} />
                </div>
              </div>

              {/* Địa chỉ nhận hàng */}
              <div className="px-4 py-3 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-slate-800">Địa chỉ nhận hàng</span>
                </div>
                <div className="pl-6">
                  {order.recipient_address ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">
                          {maskText(order.recipient_address.name, 1, 1)}
                        </span>
                        <span className="text-slate-500">
                          {maskText(order.recipient_address.phone, 0, 2)}
                        </span>
                      </div>
                      <p className="text-slate-500">
                        {order.recipient_address.full_address?.replace(/[^,\s]/g, (char: string, i: number, str: string) => {
                          const commaIndex = str.lastIndexOf(',');
                          return i < commaIndex - 10 ? '*' : char;
                        })}
                      </p>
                      <p className="text-slate-500">
                        {[
                          order.recipient_address.town,
                          order.recipient_address.district,
                          order.recipient_address.city,
                          order.recipient_address.state
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-sm">Không có thông tin địa chỉ</p>
                  )}
                </div>
              </div>

              {/* Thông tin vận chuyển */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-800">Thông tin vận chuyển</span>
                </div>
                <div className="pl-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-700">Kiện hàng 1:</span>
                    <span className="text-slate-600">{order.shipping_carrier || 'Nhanh'}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600">{order.checkout_shipping_carrier || 'SPX Express'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {items.slice(0, 3).map((item: OrderItem, idx: number) => (
                        item.image_info?.image_url ? (
                          <img
                            key={idx}
                            src={item.image_info.image_url}
                            alt=""
                            className="w-10 h-10 rounded border-2 border-white object-cover"
                          />
                        ) : (
                          <div key={idx} className="w-10 h-10 rounded border-2 border-white bg-slate-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-slate-400" />
                          </div>
                        )
                      ))}
                    </div>
                    <span className="text-sm text-slate-500">Total {items.length} products</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Buyer Info Card */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{order.buyer_username}</span>
                </div>
                <Button variant="outline" size="sm" className="text-sm text-orange-500 border-orange-500 hover:bg-orange-50">
                  Theo dõi
                </Button>
              </div>
            </div>

            {/* Payment Info Table */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-semibold text-slate-800">Thông tin thanh toán</span>
                </div>
                <button className="text-sm text-blue-600 hover:underline">
                  Xem lịch sử giao dịch
                </button>
              </div>

              {/* Products Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide w-10">STT</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Sản phẩm</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide w-24">Đơn Giá</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide w-16">SL</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide w-24">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item: OrderItem, idx: number) => {
                      const escrowItem = escrowData?.order_income.items?.find(
                        ei => ei.item_id === item.item_id && ei.model_id === item.model_id
                      );
                      const isGift = escrowItem?.discounted_price === 0 || item.model_discounted_price === 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-3 py-3 text-sm text-slate-500 align-top">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-3">
                              {/* Product Image - Smaller size */}
                              <div className="flex-shrink-0">
                                {item.image_info?.image_url ? (
                                  <ImageWithZoom
                                    src={item.image_info.image_url}
                                    alt={item.item_name}
                                    className="w-12 h-12 object-cover rounded border"
                                    zoomSize={200}
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-slate-100 rounded border flex items-center justify-center">
                                    <Package className="w-5 h-5 text-slate-400" />
                                  </div>
                                )}
                              </div>
                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                {/* Gift tag + Product name - inline layout */}
                                <div className="text-sm text-slate-700 leading-snug">
                                  {isGift && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-400 mr-1.5 align-middle">
                                      Quà tặng
                                    </span>
                                  )}
                                  <span>{item.item_name}</span>
                                </div>
                                {/* Variant */}
                                {item.model_name && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Phân loại: {item.model_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 text-right align-top">
                            {formatPrice(item.model_discounted_price, order.currency)}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 text-center align-top">
                            {item.model_quantity_purchased}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 text-right align-top">
                            {formatPrice(item.model_discounted_price * item.model_quantity_purchased, order.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary - Dynamic rendering */}
              <div className="border-t px-4 py-4">
                <details className="group" open>
                  <summary className="flex items-center justify-end gap-1 cursor-pointer text-sm text-blue-600 hover:underline mb-4">
                    <span>Ẩn chi tiết doanh thu</span>
                    <span className="group-open:rotate-180 transition-transform text-xs">▲</span>
                  </summary>

                  <EscrowFinancialSummary
                    escrowData={escrowData}
                    order={order}
                    items={items}
                    currency={order.currency}
                  />
                </details>
              </div>
            </div>

            {/* Số tiền cuối cùng */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Số tiền cuối cùng</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-orange-500">
                    {formatPrice(
                      (order.order_status === 'CANCELLED' || order.order_status === 'IN_CANCEL')
                        ? 0
                        : (escrowData?.order_income.escrow_amount_after_adjustment ||
                           escrowData?.order_income.escrow_amount ||
                           order.total_amount),
                      order.currency
                    )}
                  </span>
                  {escrowData?.order_income.total_adjustment_amount !== undefined &&
                   escrowData.order_income.total_adjustment_amount !== 0 &&
                   order.order_status !== 'CANCELLED' && order.order_status !== 'IN_CANCEL' && (
                    <div className="text-xs text-slate-500">
                      (Đã điều chỉnh: {escrowData.order_income.total_adjustment_amount >= 0 ? '+' : ''}
                      {formatPrice(escrowData.order_income.total_adjustment_amount, order.currency)})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Điều chỉnh đặt hàng */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <FileText className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold text-slate-800">Điều chỉnh đặt hàng</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Ngày hoàn thành điều chỉnh đơn hàng</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Lý do điều chỉnh</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Số tiền thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrowData?.order_income.order_adjustment && escrowData.order_income.order_adjustment.length > 0 ? (
                      escrowData.order_income.order_adjustment.map((adj, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-4 py-3 text-slate-600">
                            {adj.date ? formatDateTime(adj.date) : '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {adj.adjustment_reason || '-'}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right font-medium",
                            adj.amount >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {adj.amount >= 0 ? '+' : ''}{formatPrice(adj.amount, adj.currency || order.currency)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center">
                          <div className="flex flex-col items-center text-slate-400">
                            <FileText className="h-8 w-8 mb-2 opacity-50" />
                            <span className="text-sm">Chưa có điều chỉnh nào được thực hiện theo thứ tự này</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Thanh toán của Người Mua */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <User className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-slate-800">Thanh toán của Người Mua</span>
              </div>
              <div className="px-4 py-4 text-sm">
                <BuyerPaymentSummary
                  buyerPaymentInfo={escrowData?.buyer_payment_info}
                  orderIncome={escrowData?.order_income}
                  order={order}
                  currency={order.currency}
                />
              </div>
            </div>

            {/* Đơn hoàn trả (nếu có) */}
            {escrowData?.return_order_sn_list && escrowData.return_order_sn_list.length > 0 && (
              <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-orange-200">
                  <Package className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-700">Đơn hoàn trả ({escrowData.return_order_sn_list.length})</span>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {escrowData.return_order_sn_list.map((sn, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-orange-200">
                        <code className="font-mono text-sm text-orange-700">{sn}</code>
                        <CopyButton text={sn} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Thông tin hủy đơn (nếu có) */}
            {(order.order_status === 'CANCELLED' || order.order_status === 'IN_CANCEL') && (
              <div className="bg-red-50 rounded-lg shadow-sm border border-red-200">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">Thông tin hủy đơn</span>
                </div>
                <div className="p-4 text-sm space-y-2">
                  {order.cancel_by && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hủy bởi:</span>
                      <span className="text-red-600 font-medium">{order.cancel_by}</span>
                    </div>
                  )}
                  {order.cancel_reason && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lý do hủy:</span>
                      <span className="text-slate-700">{order.cancel_reason}</span>
                    </div>
                  )}
                  {order.buyer_cancel_reason && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lý do từ người mua:</span>
                      <span className="text-slate-700">{order.buyer_cancel_reason}</span>
                    </div>
                  )}
                  {!order.cancel_by && !order.cancel_reason && !order.buyer_cancel_reason && (
                    <p className="text-slate-400 italic">Không có thông tin chi tiết</p>
                  )}
                </div>
              </div>
            )}

            {loadingEscrow && (
              <div className="bg-white rounded shadow-sm border p-4 flex items-center justify-center">
                <Spinner className="h-5 w-5 mr-2" />
                <span className="text-sm text-slate-500">Đang tải thông tin tài chính...</span>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - Notes & History */}
          <div className="w-72 space-y-4">
            {/* Notes */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Thêm {order.note ? '1' : '0'} ghi chú</span>
                </div>
              </div>
              <div className="p-4 text-sm text-slate-500 min-h-[60px]">
                {order.note || <span className="text-slate-400 italic">Chưa có ghi chú</span>}
              </div>
            </div>

            {/* Order History */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-4 py-3 border-b">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">LỊCH SỬ ĐƠN HÀNG</span>
              </div>
              <div className="p-4">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

                  {/* Timeline items */}
                  <div className="space-y-4">
                    <div className="flex gap-3 relative">
                      <div className="w-3 h-3 rounded-full bg-orange-500 mt-1 z-10"></div>
                      <div>
                        <p className="text-sm font-medium text-orange-600">Đơn hàng mới</p>
                        <p className="text-xs text-slate-500">{formatDateTime(order.create_time)}</p>
                      </div>
                    </div>

                    {order.pay_time && order.pay_time !== order.create_time && (
                      <div className="flex gap-3 relative">
                        <div className="w-3 h-3 rounded-full bg-slate-300 mt-1 z-10"></div>
                        <div>
                          <p className="text-sm text-slate-600">Đã thanh toán</p>
                          <p className="text-xs text-slate-500">{formatDateTime(order.pay_time)}</p>
                        </div>
                      </div>
                    )}

                    {order.pickup_done_time && (
                      <div className="flex gap-3 relative">
                        <div className="w-3 h-3 rounded-full bg-slate-300 mt-1 z-10"></div>
                        <div>
                          <p className="text-sm text-slate-600">Đã lấy hàng</p>
                          <p className="text-xs text-slate-500">{formatDateTime(order.pickup_done_time)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Message from buyer */}
            {order.message_to_seller && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="px-4 py-3 border-b">
                  <span className="text-sm font-semibold text-slate-700">Tin nhắn từ người mua</span>
                </div>
                <div className="p-4 text-sm text-slate-500">
                  {order.message_to_seller}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
