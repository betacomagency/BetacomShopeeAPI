/**
 * useOrderReportsOptimized - Optimized hooks for order analytics
 *
 * Features:
 * - Lazy loading per tab - only fetch when tab is active
 * - Server-side aggregation via Edge Function
 * - Fallback to client-side processing when Edge Function unavailable
 * - Separate caching per tab for better memory efficiency
 * - Pagination support for product list
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ==================== TYPES ====================

export type OrderReportTab = 'created' | 'completed' | 'value' | 'product' | 'status' | 'cancel';

export interface CustomDateRange {
  from: Date;
  to: Date;
}

export interface DailyOrderStats {
  date: string;
  created: number;
  createdProductQty: number;
  createdRevenue: number;
  createdShippingFee: number;
  createdAvgOrderValue: number;
  createdProfit: number;
  completed: number;
  completedProductQty: number;
  completedRevenue: number;
  completedShippingFee: number;
  completedBuyerShippingFee: number;
  completedProfit: number;
  cvr: number;
  cancelled: number;
  revenue: number;
}

export interface DailyCompletedStats {
  date: string;
  rowNum: number;
  productQty: number;
  orderCount: number;
  returnCount: number;
  totalSales: number;
  totalRefund: number;
  vat: number;
  buyerShippingFee: number;
  shippingFee: number;
  codFee: number;
  insuranceFee: number;
  feeDiff: number;
  bankTransfer: number;
  serviceFee: number;
  transactionFee: number;
  commission: number;
  pointsUsed: number;
  deposit: number;
  revenue: number;
  actualReceived: number;
  actualPaid: number;
  completed: number;
}

export interface OrderValueRange {
  range: string;
  min: number;
  max: number;
  count: number;
  revenue: number;
  percent: number;
}

export interface QuantityRangeStats {
  range: string;
  min: number;
  max: number;
  count: number;
  percent: number;
}

export interface ProductDetailedStats {
  itemId: number;
  itemName: string;
  imageUrl: string | null;
  price: number;
  ordersCount: number;
  ordersSP: number;
  cancelledOrders: number;
  cancelledSP: number;
  cancelledPercent: number;
  shippingOrders: number;
  shippingSP: number;
  completedOrders: number;
  completedSP: number;
  completedPercent: number;
  returnsOrders: number;
  returnsSP: number;
  returnsPercent: number;
  notShippedOrders: number;
  notShippedSP: number;
  notShippedPercent: number;
}

export interface StatusStats {
  status: string;
  statusLabel: string;
  count: number;
  revenue: number;
  percent: number;
}

export interface DailyStatusStats {
  date: string;
  confirmedCount: number;
  confirmedAmount: number;
  packagingCount: number;
  packagingAmount: number;
  shippingCount: number;
  shippingAmount: number;
  completedCount: number;
  completedAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
  returnsCount: number;
  returnsAmount: number;
  totalCount: number;
  totalAmount: number;
}

export interface CancelReasonStats {
  reason: string;
  systemCount: number;
  returnedCount: number;
  totalCount: number;
  systemPercent: number;
  returnedPercent: number;
  totalPercent: number;
}

export interface OrderReportsTotals {
  created: number;
  completed: number;
  cancelled: number;
  totalRevenue: number;
}

export interface ProductsResponse {
  items: ProductDetailedStats[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== CONSTANTS ====================

const EDGE_FUNCTION_URL = 'apishopee-order-reports';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const GC_TIME = 30 * 60 * 1000; // 30 minutes

// ==================== HELPERS ====================

function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// Get timezone offset in hours (e.g., Vietnam UTC+7 returns 7)
function getTimezoneOffset(): number {
  const offset = new Date().getTimezoneOffset(); // Returns minutes, negative for UTC+
  return -offset / 60;
}

function formatLocalDate(timestamp: number): string {
  // Use local timezone for date formatting
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date from Date object to YYYY-MM-DD string (local timezone)
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Status labels
const STATUS_LABELS: Record<string, string> = {
  'UNPAID': 'Chưa thanh toán',
  'READY_TO_SHIP': 'Chờ lấy hàng',
  'PROCESSED': 'Đã xử lý',
  'SHIPPED': 'Đang giao',
  'TO_CONFIRM_RECEIVE': 'Chờ xác nhận',
  'COMPLETED': 'Hoàn thành',
  'TO_RETURN': 'Trả hàng',
  'IN_CANCEL': 'Đang hủy',
  'CANCELLED': 'Đã hủy',
  'INVOICE_PENDING': 'Chờ hóa đơn',
  'PENDING': 'Đang xử lý',
};

// Cancel reason labels - Vietnamese translations for Shopee cancel reasons
const CANCEL_REASON_LABELS: Record<string, string> = {
  // Basic reasons
  'buyer_request': 'Người mua yêu cầu',
  'out_of_stock': 'Hết hàng',
  'customer_request': 'Khách hàng yêu cầu',
  'unable_to_deliver': 'Không thể giao hàng',
  'wrong_price': 'Giá sai',
  'duplicate_order': 'Đơn trùng',
  'seller_request': 'Người bán yêu cầu',
  'system_cancel': 'Hệ thống hủy',
  'other': 'Lý do khác',
  'Others': 'Lý do khác',

  // Detailed Shopee cancel reasons
  'Modify existing order (colour, size, address, voucher, etc.)': 'Muốn thay đổi đơn hàng (màu, size, địa chỉ, voucher...)',
  'Others / change of mind': 'Đổi ý / Lý do khác',
  'Unpaid Order': 'Đơn hàng chưa thanh toán',
  'Need to input / Change Voucher Code': 'Cần nhập / Đổi mã giảm giá',
  'Need to change delivery address': 'Cần thay đổi địa chỉ giao hàng',
  'Need to Modify Order': 'Cần sửa đổi đơn hàng',
  'Failed Delivery': 'Giao hàng thất bại',
  'Need to Change Delivery Address': 'Cần thay đổi địa chỉ giao hàng',
  "Don't Want to Buy Anymore": 'Không muốn mua nữa',
  'Found Cheaper Elsewhere': 'Tìm được giá rẻ hơn ở nơi khác',
  'Other': 'Lý do khác',
  'Seller is not responsive to my inquiries': 'Người bán không phản hồi',
  'Payment Procedure too Troublesome': 'Thủ tục thanh toán quá phức tạp',

  // Additional common reasons
  'Buyer requested to cancel': 'Người mua yêu cầu hủy',
  'Item out of stock': 'Hết hàng',
  'Seller requested to cancel': 'Người bán yêu cầu hủy',
  'System auto-cancel': 'Hệ thống tự động hủy',
  'Payment timeout': 'Hết thời gian thanh toán',
  'Shipping address issue': 'Vấn đề địa chỉ giao hàng',
  'Product quality issue': 'Vấn đề chất lượng sản phẩm',
  'Wrong product received': 'Nhận sai sản phẩm',
  'Delivery delayed': 'Giao hàng chậm trễ',
  'COD payment refused': 'Từ chối thanh toán COD',
};

// Value ranges
const VALUE_RANGES = [
  { label: '< 200.000', min: 0, max: 200000 },
  { label: '200.000 - 500.000', min: 200000, max: 500000 },
  { label: '500.000 - 1.000.000', min: 500000, max: 1000000 },
  { label: '1.000.000 - 2.000.000', min: 1000000, max: 2000000 },
  { label: '> 2.000.000', min: 2000000, max: 999999999 },
];

// Quantity ranges
const QUANTITY_RANGES = [
  { label: '1', min: 1, max: 1 },
  { label: '2', min: 2, max: 2 },
  { label: '3', min: 3, max: 3 },
  { label: '4', min: 4, max: 4 },
  { label: '5', min: 5, max: 5 },
  { label: '6-7', min: 6, max: 7 },
  { label: '8-10', min: 8, max: 10 },
  { label: '> 10', min: 11, max: 9999 },
];

// ==================== EDGE FUNCTION CALL ====================

async function callEdgeFunction(
  tab: OrderReportTab | 'all',
  shopId: number,
  dateRange: CustomDateRange,
  options?: { page?: number; pageSize?: number; search?: string }
) {
  // Set start date to beginning of day (00:00:00)
  const startDate = new Date(dateRange.from);
  startDate.setHours(0, 0, 0, 0);

  // Set end date to end of day (23:59:59)
  const endDate = new Date(dateRange.to);
  endDate.setHours(23, 59, 59, 999);

  const startTs = toUnixTimestamp(startDate);
  const endTs = toUnixTimestamp(endDate);
  const timezoneOffset = getTimezoneOffset();

  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_URL, {
    body: {
      shop_id: shopId,
      start_ts: startTs,
      end_ts: endTs,
      timezone_offset: timezoneOffset,
      tab,
      page: options?.page || 1,
      page_size: options?.pageSize || 50,
      search: options?.search || '',
    },
  });

  if (error) {
    console.error('[useOrderReports] Edge function error:', error);
    throw error;
  }

  return data;
}

// ==================== CLIENT-SIDE FALLBACK PROCESSING ====================

interface OrderData {
  order_sn: string;
  order_status: string;
  create_time: number;
  update_time?: number;
  total_amount?: number;
  actual_shipping_fee?: number;
  estimated_shipping_fee?: number;
  buyer_paid_shipping_fee?: number;
  cod_fee?: number;
  insurance_fee?: number;
  service_fee?: number;
  shopee_fee?: number;
  transaction_fee?: number;
  card_txn_fee?: number;
  commission_fee?: number;
  seller_discount?: number;
  coins?: number;
  voucher_from_seller?: number;
  buyer_txn_fee?: number;
  buyer_cancel_reason?: string;
  cancel_reason?: string;
  cancel_by?: string;
  item_list?: Array<{
    item_id: number;
    item_name: string;
    image_info?: { image_url: string };
    model_quantity_purchased: number;
    model_discounted_price: number;
  }>;
}

async function fetchOrdersFromDB(
  shopId: number,
  dateRange: CustomDateRange
): Promise<OrderData[]> {
  // Set start date to beginning of day (00:00:00)
  const startDate = new Date(dateRange.from);
  startDate.setHours(0, 0, 0, 0);

  // Set end date to end of day (23:59:59)
  const endDate = new Date(dateRange.to);
  endDate.setHours(23, 59, 59, 999);

  const startTs = toUnixTimestamp(startDate);
  const endTs = toUnixTimestamp(endDate);

  const BATCH_SIZE = 1000;
  let allOrders: OrderData[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('apishopee_orders')
      .select('order_sn,order_status,create_time,update_time,total_amount,actual_shipping_fee,estimated_shipping_fee,buyer_paid_shipping_fee,cod_fee,insurance_fee,service_fee,shopee_fee,transaction_fee,card_txn_fee,commission_fee,seller_discount,coins,voucher_from_seller,buyer_txn_fee,buyer_cancel_reason,cancel_reason,cancel_by,item_list')
      .eq('shop_id', shopId)
      .gte('create_time', startTs)
      .lte('create_time', endTs)
      .order('create_time', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;

    if (!batch || batch.length === 0) {
      hasMore = false;
    } else {
      allOrders = [...allOrders, ...batch];
      offset += BATCH_SIZE;
      hasMore = batch.length === BATCH_SIZE;
    }
  }

  return allOrders;
}

// Fetch return orders by update_time (for orders that were created before but returned during the period)
async function fetchReturnOrdersByUpdateTime(
  shopId: number,
  dateRange: CustomDateRange
): Promise<OrderData[]> {
  const startDate = new Date(dateRange.from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateRange.to);
  endDate.setHours(23, 59, 59, 999);

  const startTs = toUnixTimestamp(startDate);
  const endTs = toUnixTimestamp(endDate);

  const BATCH_SIZE = 1000;
  let allOrders: OrderData[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('apishopee_orders')
      .select('order_sn,order_status,create_time,update_time,total_amount,actual_shipping_fee,estimated_shipping_fee,buyer_paid_shipping_fee,cod_fee,insurance_fee,service_fee,shopee_fee,transaction_fee,card_txn_fee,commission_fee,seller_discount,coins,voucher_from_seller,buyer_txn_fee,buyer_cancel_reason,cancel_reason,cancel_by,item_list')
      .eq('shop_id', shopId)
      .eq('order_status', 'TO_RETURN')
      .gte('update_time', startTs)
      .lte('update_time', endTs)
      .order('update_time', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;

    if (!batch || batch.length === 0) {
      hasMore = false;
    } else {
      allOrders = [...allOrders, ...batch];
      offset += BATCH_SIZE;
      hasMore = batch.length === BATCH_SIZE;
    }
  }

  return allOrders;
}

// Process daily created stats
function processDailyCreated(orders: OrderData[], dateRange: CustomDateRange): DailyOrderStats[] {
  const dailyMap = new Map<string, DailyOrderStats>();

  // Initialize dates using local timezone
  const currentDate = new Date(dateRange.from);
  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateRange.to);
  endDate.setHours(23, 59, 59, 999);

  while (currentDate <= endDate) {
    const dateStr = formatDateToString(currentDate);
    dailyMap.set(dateStr, {
      date: dateStr,
      created: 0,
      createdProductQty: 0,
      createdRevenue: 0,
      createdShippingFee: 0,
      createdAvgOrderValue: 0,
      createdProfit: 0,
      completed: 0,
      completedProductQty: 0,
      completedRevenue: 0,
      completedShippingFee: 0,
      completedBuyerShippingFee: 0,
      completedProfit: 0,
      cvr: 0,
      cancelled: 0,
      revenue: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  orders.forEach((order) => {
    const createDate = formatLocalDate(order.create_time);
    const daily = dailyMap.get(createDate);
    if (!daily) return;

    const productQty = order.item_list?.reduce((sum, item) => sum + (item.model_quantity_purchased || 1), 0) || 0;
    const shippingFee = order.actual_shipping_fee || order.estimated_shipping_fee || 0;
    const buyerShippingFee = order.buyer_paid_shipping_fee || order.estimated_shipping_fee || 0;
    const revenue = order.total_amount || 0;

    daily.created++;
    daily.createdProductQty += productQty;
    daily.createdRevenue += revenue;
    daily.createdShippingFee += shippingFee;

    if (order.order_status === 'COMPLETED') {
      daily.completed++;
      daily.completedProductQty += productQty;
      daily.completedRevenue += revenue;
      daily.completedShippingFee += shippingFee;
      daily.completedBuyerShippingFee += buyerShippingFee;
      daily.revenue += revenue;
    }

    if (order.order_status === 'CANCELLED' || order.order_status === 'IN_CANCEL') {
      daily.cancelled++;
    }
  });

  return Array.from(dailyMap.values()).map((day) => ({
    ...day,
    createdAvgOrderValue: day.created > 0 ? Math.round(day.createdRevenue / day.created) : 0,
    createdProfit: Math.round(day.createdRevenue * 0.48 - day.createdShippingFee * 0.1),
    completedProfit: Math.round(day.completedRevenue * 0.48 - day.completedShippingFee * 0.1),
    cvr: day.created > 0 ? Math.round((day.completed / day.created) * 10000) / 100 : 0,
  }));
}

// Process daily completed stats
function processDailyCompleted(orders: OrderData[], dateRange: CustomDateRange): DailyCompletedStats[] {
  const dailyMap = new Map<string, Omit<DailyCompletedStats, 'rowNum'>>();

  // Initialize dates using local timezone
  const currentDate = new Date(dateRange.from);
  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateRange.to);
  endDate.setHours(23, 59, 59, 999);

  while (currentDate <= endDate) {
    const dateStr = formatDateToString(currentDate);
    dailyMap.set(dateStr, {
      date: dateStr,
      productQty: 0,
      orderCount: 0,
      returnCount: 0,
      totalSales: 0,
      totalRefund: 0,
      vat: 0,
      buyerShippingFee: 0,
      shippingFee: 0,
      codFee: 0,
      insuranceFee: 0,
      feeDiff: 0,
      bankTransfer: 0,
      serviceFee: 0,
      transactionFee: 0,
      commission: 0,
      pointsUsed: 0,
      deposit: 0,
      revenue: 0,
      actualReceived: 0,
      actualPaid: 0,
      completed: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Process completed orders (giao thành công)
  orders.forEach((order) => {
    if (order.order_status !== 'COMPLETED') return;
    if (!order.update_time) return;

    const completedDate = formatLocalDate(order.update_time);
    const daily = dailyMap.get(completedDate);
    if (!daily) return;

    const productQty = order.item_list?.reduce((sum, item) => sum + (item.model_quantity_purchased || 1), 0) || 0;
    const totalAmount = order.total_amount || 0;
    const buyerPaidShipping = order.buyer_paid_shipping_fee || 0;
    const actualShipping = order.actual_shipping_fee || order.estimated_shipping_fee || 0;
    const codFee = order.cod_fee || 0;
    const insuranceFee = order.insurance_fee || 0;
    const serviceFee = order.service_fee || order.shopee_fee || 0;
    const transactionFee = order.transaction_fee || order.card_txn_fee || 0;
    const commission = order.commission_fee || order.seller_discount || 0;
    const pointsUsed = order.coins || order.voucher_from_seller || 0;
    const bankTransfer = order.buyer_txn_fee || 0;

    daily.orderCount++;
    daily.completed++;
    daily.productQty += productQty;
    daily.totalSales += totalAmount;
    daily.buyerShippingFee += buyerPaidShipping;
    daily.shippingFee += actualShipping;
    daily.codFee += codFee;
    daily.insuranceFee += insuranceFee;
    daily.serviceFee += serviceFee;
    daily.transactionFee += transactionFee;
    daily.commission += commission;
    daily.pointsUsed += pointsUsed;
    daily.bankTransfer += bankTransfer;

    const feeDiff = buyerPaidShipping - actualShipping - codFee;
    daily.feeDiff += feeDiff;

    const revenue = totalAmount - commission - pointsUsed;
    daily.revenue += revenue;

    const actualReceived = buyerPaidShipping + revenue - bankTransfer;
    daily.actualReceived += actualReceived;

    const actualPaid = buyerPaidShipping + revenue - actualShipping - codFee - insuranceFee - bankTransfer - serviceFee - transactionFee;
    daily.actualPaid += actualPaid;
  });

  // Process return orders (trả thành công) - orders with TO_RETURN status
  orders.forEach((order) => {
    if (order.order_status !== 'TO_RETURN') return;
    if (!order.update_time) return;

    const returnDate = formatLocalDate(order.update_time);
    const daily = dailyMap.get(returnDate);
    if (!daily) return;

    daily.returnCount++;
  });

  return Array.from(dailyMap.values()).map((day, index) => ({
    ...day,
    rowNum: index + 1,
  }));
}

// Process value ranges
function processValueRanges(orders: OrderData[]): { valueRanges: OrderValueRange[]; quantityRanges: QuantityRangeStats[] } {
  const completedOrders = orders.filter((o) => o.order_status === 'COMPLETED');
  const totalCompleted = completedOrders.length;

  const valueRangeCounts = VALUE_RANGES.map(() => 0);
  const valueRangeRevenues = VALUE_RANGES.map(() => 0);
  const quantityRangeCounts = QUANTITY_RANGES.map(() => 0);

  completedOrders.forEach((order) => {
    const amount = order.total_amount || 0;
    const productQty = order.item_list?.reduce((sum, item) => sum + (item.model_quantity_purchased || 1), 0) || 0;

    for (let i = 0; i < VALUE_RANGES.length; i++) {
      if (amount >= VALUE_RANGES[i].min && amount < VALUE_RANGES[i].max) {
        valueRangeCounts[i]++;
        valueRangeRevenues[i] += amount;
        break;
      }
    }

    for (let i = 0; i < QUANTITY_RANGES.length; i++) {
      const range = QUANTITY_RANGES[i];
      if (productQty >= range.min && productQty <= range.max) {
        quantityRangeCounts[i]++;
        break;
      }
    }
  });

  return {
    valueRanges: VALUE_RANGES.map((range, i) => ({
      range: range.label,
      min: range.min,
      max: range.max,
      count: valueRangeCounts[i],
      revenue: valueRangeRevenues[i],
      percent: totalCompleted > 0 ? Math.round((valueRangeCounts[i] / totalCompleted) * 10000) / 100 : 0,
    })),
    quantityRanges: QUANTITY_RANGES.map((range, i) => ({
      range: range.label,
      min: range.min,
      max: range.max,
      count: quantityRangeCounts[i],
      percent: totalCompleted > 0 ? Math.round((quantityRangeCounts[i] / totalCompleted) * 10000) / 100 : 0,
    })),
  };
}

// Process products
function processProducts(orders: OrderData[], page: number, pageSize: number, search: string): ProductsResponse {
  const productMap = new Map<number, Omit<ProductDetailedStats, 'cancelledPercent' | 'completedPercent' | 'returnsPercent' | 'notShippedPercent'>>();

  orders.forEach((order) => {
    if (!order.item_list) return;
    const status = order.order_status;

    order.item_list.forEach((item) => {
      const qty = item.model_quantity_purchased || 1;
      const price = item.model_discounted_price || 0;

      let existing = productMap.get(item.item_id);
      if (!existing) {
        existing = {
          itemId: item.item_id,
          itemName: item.item_name || 'Không tên',
          imageUrl: item.image_info?.image_url || null,
          price,
          ordersCount: 0,
          ordersSP: 0,
          cancelledOrders: 0,
          cancelledSP: 0,
          shippingOrders: 0,
          shippingSP: 0,
          completedOrders: 0,
          completedSP: 0,
          returnsOrders: 0,
          returnsSP: 0,
          notShippedOrders: 0,
          notShippedSP: 0,
        };
        productMap.set(item.item_id, existing);
      }

      existing.ordersCount++;
      existing.ordersSP += qty;
      if (price > existing.price) existing.price = price;

      if (status === 'CANCELLED' || status === 'IN_CANCEL') {
        existing.cancelledOrders++;
        existing.cancelledSP += qty;
      } else if (status === 'COMPLETED') {
        existing.completedOrders++;
        existing.completedSP += qty;
      } else if (status === 'TO_RETURN') {
        existing.returnsOrders++;
        existing.returnsSP += qty;
      } else if (status === 'SHIPPED' || status === 'READY_TO_SHIP' || status === 'TO_CONFIRM_RECEIVE') {
        existing.shippingOrders++;
        existing.shippingSP += qty;
      } else {
        existing.notShippedOrders++;
        existing.notShippedSP += qty;
      }
    });
  });

  let products = Array.from(productMap.values()).map((p) => ({
    ...p,
    cancelledPercent: p.ordersSP > 0 ? Math.round((p.cancelledSP / p.ordersSP) * 10000) / 100 : 0,
    completedPercent: p.ordersSP > 0 ? Math.round((p.completedSP / p.ordersSP) * 10000) / 100 : 0,
    returnsPercent: p.ordersSP > 0 ? Math.round((p.returnsSP / p.ordersSP) * 10000) / 100 : 0,
    notShippedPercent: p.ordersSP > 0 ? Math.round((p.notShippedSP / p.ordersSP) * 10000) / 100 : 0,
  }));

  if (search) {
    const searchLower = search.toLowerCase();
    products = products.filter((p) => p.itemName.toLowerCase().includes(searchLower));
  }

  products.sort((a, b) => b.ordersSP - a.ordersSP);

  const total = products.length;
  const startIndex = (page - 1) * pageSize;
  const items = products.slice(startIndex, startIndex + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// Process status breakdown
function processStatusBreakdown(orders: OrderData[], dateRange: CustomDateRange): { statusBreakdown: StatusStats[]; dailyStatusStats: DailyStatusStats[] } {
  const statusMap = new Map<string, { count: number; revenue: number }>();
  const dailyStatusMap = new Map<string, DailyStatusStats>();

  // Initialize dates using local timezone
  const currentDate = new Date(dateRange.from);
  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateRange.to);
  endDate.setHours(23, 59, 59, 999);

  while (currentDate <= endDate) {
    const dateStr = formatDateToString(currentDate);
    dailyStatusMap.set(dateStr, {
      date: dateStr,
      confirmedCount: 0,
      confirmedAmount: 0,
      packagingCount: 0,
      packagingAmount: 0,
      shippingCount: 0,
      shippingAmount: 0,
      completedCount: 0,
      completedAmount: 0,
      cancelledCount: 0,
      cancelledAmount: 0,
      returnsCount: 0,
      returnsAmount: 0,
      totalCount: 0,
      totalAmount: 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  orders.forEach((order) => {
    const status = order.order_status || 'UNKNOWN';
    const revenue = order.total_amount || 0;
    const createDate = formatLocalDate(order.create_time);

    const entry = statusMap.get(status) || { count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += revenue;
    statusMap.set(status, entry);

    const dailyStatus = dailyStatusMap.get(createDate);
    if (dailyStatus) {
      dailyStatus.totalCount++;
      dailyStatus.totalAmount += revenue;

      if (status === 'UNPAID' || status === 'PENDING' || status === 'INVOICE_PENDING') {
        dailyStatus.confirmedCount++;
        dailyStatus.confirmedAmount += revenue;
      } else if (status === 'PROCESSED' || status === 'READY_TO_SHIP') {
        dailyStatus.packagingCount++;
        dailyStatus.packagingAmount += revenue;
      } else if (status === 'SHIPPED' || status === 'TO_CONFIRM_RECEIVE') {
        dailyStatus.shippingCount++;
        dailyStatus.shippingAmount += revenue;
      } else if (status === 'COMPLETED') {
        dailyStatus.completedCount++;
        dailyStatus.completedAmount += revenue;
      } else if (status === 'CANCELLED' || status === 'IN_CANCEL') {
        dailyStatus.cancelledCount++;
        dailyStatus.cancelledAmount += revenue;
      } else if (status === 'TO_RETURN') {
        dailyStatus.returnsCount++;
        dailyStatus.returnsAmount += revenue;
      }
    }
  });

  const totalCreated = orders.length;

  return {
    statusBreakdown: Array.from(statusMap.entries())
      .map(([status, data]) => ({
        status,
        statusLabel: STATUS_LABELS[status] || status,
        count: data.count,
        revenue: data.revenue,
        percent: totalCreated > 0 ? Math.round((data.count / totalCreated) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count),
    dailyStatusStats: Array.from(dailyStatusMap.values()),
  };
}

// Process cancel reasons
function processCancelReasons(orders: OrderData[]): CancelReasonStats[] {
  const cancelReasonMap = new Map<string, { systemCount: number; returnedCount: number }>();

  const cancelledOrders = orders.filter(
    (o) => o.order_status === 'CANCELLED' || o.order_status === 'IN_CANCEL'
  );

  cancelledOrders.forEach((order) => {
    const reason = order.buyer_cancel_reason || order.cancel_reason || 'other';
    const cancelBy = order.cancel_by || 'unknown';

    const entry = cancelReasonMap.get(reason) || { systemCount: 0, returnedCount: 0 };

    if (cancelBy === 'buyer' || cancelBy === 'customer') {
      entry.returnedCount++;
    } else {
      entry.systemCount++;
    }
    cancelReasonMap.set(reason, entry);
  });

  const totalCancelled = cancelledOrders.length;

  return Array.from(cancelReasonMap.entries())
    .map(([reason, data]) => {
      const totalCount = data.systemCount + data.returnedCount;
      return {
        reason: CANCEL_REASON_LABELS[reason] || reason,
        systemCount: data.systemCount,
        returnedCount: data.returnedCount,
        totalCount,
        systemPercent: totalCancelled > 0 ? Math.round((data.systemCount / totalCancelled) * 10000) / 100 : 0,
        returnedPercent: totalCancelled > 0 ? Math.round((data.returnedCount / totalCancelled) * 10000) / 100 : 0,
        totalPercent: totalCancelled > 0 ? Math.round((totalCount / totalCancelled) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);
}

// ==================== HOOKS ====================

/**
 * Hook for totals - lightweight, always fetched
 */
export function useOrderReportsTotals(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null
) {
  const queryKey = useMemo(
    () => ['order-reports-totals', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime()],
    [shopId, userId, dateRange]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<OrderReportsTotals> => {
      if (!shopId || !userId || !dateRange) {
        return { created: 0, completed: 0, cancelled: 0, totalRevenue: 0 };
      }

      try {
        // Try Edge Function first
        const response = await callEdgeFunction('all', shopId, dateRange);
        return response.totals;
      } catch {
        // Fallback to direct query with count aggregation
        const startTs = toUnixTimestamp(dateRange.from);
        const endTs = toUnixTimestamp(dateRange.to);

        const { count: totalCreated } = await supabase
          .from('apishopee_orders')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .gte('create_time', startTs)
          .lte('create_time', endTs);

        const { count: totalCompleted } = await supabase
          .from('apishopee_orders')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .eq('order_status', 'COMPLETED')
          .gte('create_time', startTs)
          .lte('create_time', endTs);

        const { count: totalCancelled } = await supabase
          .from('apishopee_orders')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .in('order_status', ['CANCELLED', 'IN_CANCEL'])
          .gte('create_time', startTs)
          .lte('create_time', endTs);

        // Get revenue sum for completed orders
        const { data: revenueData } = await supabase
          .from('apishopee_orders')
          .select('total_amount')
          .eq('shop_id', shopId)
          .eq('order_status', 'COMPLETED')
          .gte('create_time', startTs)
          .lte('create_time', endTs);

        const totalRevenue = revenueData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

        return {
          created: totalCreated || 0,
          completed: totalCompleted || 0,
          cancelled: totalCancelled || 0,
          totalRevenue,
        };
      }
    },
    enabled: !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    totals: data || { created: 0, completed: 0, cancelled: 0, totalRevenue: 0 },
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Hook for daily created stats (Tab: Đơn tạo)
 */
export function useOrderReportsCreated(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => ['order-reports-created', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime()],
    [shopId, userId, dateRange]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<DailyOrderStats[]> => {
      if (!shopId || !userId || !dateRange) return [];

      try {
        const response = await callEdgeFunction('created', shopId, dateRange);
        return response.data;
      } catch {
        const orders = await fetchOrdersFromDB(shopId, dateRange);
        return processDailyCreated(orders, dateRange);
      }
    },
    enabled: enabled && !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    data: data || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Hook for daily completed stats (Tab: Đơn thành công)
 */
export function useOrderReportsCompleted(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => ['order-reports-completed', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime()],
    [shopId, userId, dateRange]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<DailyCompletedStats[]> => {
      if (!shopId || !userId || !dateRange) return [];

      try {
        const response = await callEdgeFunction('completed', shopId, dateRange);
        // Handle backward compatibility: map itemCount to returnCount if returnCount is undefined
        return (response.data || []).map((item: DailyCompletedStats & { itemCount?: number }) => ({
          ...item,
          returnCount: item.returnCount ?? item.itemCount ?? 0,
          productQty: item.productQty ?? 0,
          orderCount: item.orderCount ?? 0,
          totalSales: item.totalSales ?? 0,
          totalRefund: item.totalRefund ?? 0,
          vat: item.vat ?? 0,
          buyerShippingFee: item.buyerShippingFee ?? 0,
          shippingFee: item.shippingFee ?? 0,
          codFee: item.codFee ?? 0,
          insuranceFee: item.insuranceFee ?? 0,
          feeDiff: item.feeDiff ?? 0,
          bankTransfer: item.bankTransfer ?? 0,
          serviceFee: item.serviceFee ?? 0,
          transactionFee: item.transactionFee ?? 0,
          commission: item.commission ?? 0,
          pointsUsed: item.pointsUsed ?? 0,
          deposit: item.deposit ?? 0,
          revenue: item.revenue ?? 0,
          actualReceived: item.actualReceived ?? 0,
          actualPaid: item.actualPaid ?? 0,
          completed: item.completed ?? 0,
        }));
      } catch {
        // Fetch regular orders by create_time
        const orders = await fetchOrdersFromDB(shopId, dateRange);

        // Also fetch return orders by update_time (for orders created before but returned during this period)
        const returnOrders = await fetchReturnOrdersByUpdateTime(shopId, dateRange);

        // Merge orders, avoiding duplicates
        const orderSns = new Set(orders.map((o) => o.order_sn));
        const uniqueReturnOrders = returnOrders.filter((o) => !orderSns.has(o.order_sn));
        const mergedOrders = [...orders, ...uniqueReturnOrders];

        return processDailyCompleted(mergedOrders, dateRange);
      }
    },
    enabled: enabled && !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    data: data || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Hook for value ranges (Tab: Theo giá trị đơn hàng)
 */
export function useOrderReportsValue(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => ['order-reports-value', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime()],
    [shopId, userId, dateRange]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<{ valueRanges: OrderValueRange[]; quantityRanges: QuantityRangeStats[] }> => {
      if (!shopId || !userId || !dateRange) return { valueRanges: [], quantityRanges: [] };

      try {
        const response = await callEdgeFunction('value', shopId, dateRange);
        return response.data;
      } catch {
        const orders = await fetchOrdersFromDB(shopId, dateRange);
        return processValueRanges(orders);
      }
    },
    enabled: enabled && !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    valueRanges: data?.valueRanges || [],
    quantityRanges: data?.quantityRanges || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Hook for products with pagination (Tab: Theo sản phẩm)
 */
export function useOrderReportsProducts(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  options: { page: number; pageSize: number; search: string; sort: string } = { page: 1, pageSize: 50, search: '', sort: 'quantity' },
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => ['order-reports-products', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime(), options.page, options.pageSize, options.search],
    [shopId, userId, dateRange, options.page, options.pageSize, options.search]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<ProductsResponse> => {
      if (!shopId || !userId || !dateRange) {
        return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      }

      try {
        const response = await callEdgeFunction('product', shopId, dateRange, {
          page: options.page,
          pageSize: options.pageSize,
          search: options.search,
        });
        return response.data;
      } catch {
        const orders = await fetchOrdersFromDB(shopId, dateRange);
        return processProducts(orders, options.page, options.pageSize, options.search);
      }
    },
    enabled: enabled && !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  // Sort client-side for flexibility
  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    const items = [...data.items];
    switch (options.sort) {
      case 'name':
        items.sort((a, b) => a.itemName.localeCompare(b.itemName, 'vi'));
        break;
      case 'completed':
        items.sort((a, b) => b.completedSP - a.completedSP);
        break;
      case 'cancelled':
        items.sort((a, b) => b.cancelledPercent - a.cancelledPercent);
        break;
      case 'quantity':
      default:
        items.sort((a, b) => b.ordersSP - a.ordersSP);
        break;
    }
    return items;
  }, [data?.items, options.sort]);

  return {
    items: sortedItems,
    total: data?.total || 0,
    page: data?.page || 1,
    pageSize: data?.pageSize || 50,
    totalPages: data?.totalPages || 0,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Hook for status breakdown (Tab: Theo trạng thái)
 */
export function useOrderReportsStatus(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => ['order-reports-status', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime()],
    [shopId, userId, dateRange]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<{ statusBreakdown: StatusStats[]; dailyStatusStats: DailyStatusStats[] }> => {
      if (!shopId || !userId || !dateRange) return { statusBreakdown: [], dailyStatusStats: [] };

      try {
        const response = await callEdgeFunction('status', shopId, dateRange);
        return response.data;
      } catch {
        const orders = await fetchOrdersFromDB(shopId, dateRange);
        return processStatusBreakdown(orders, dateRange);
      }
    },
    enabled: enabled && !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    statusBreakdown: data?.statusBreakdown || [],
    dailyStatusStats: data?.dailyStatusStats || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Hook for cancel reasons (Tab: Lý do khách hủy)
 */
export function useOrderReportsCancel(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  enabled: boolean = true
) {
  const queryKey = useMemo(
    () => ['order-reports-cancel', shopId, userId, dateRange?.from.getTime(), dateRange?.to.getTime()],
    [shopId, userId, dateRange]
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<CancelReasonStats[]> => {
      if (!shopId || !userId || !dateRange) return [];

      try {
        const response = await callEdgeFunction('cancel', shopId, dateRange);
        return response.data;
      } catch {
        const orders = await fetchOrdersFromDB(shopId, dateRange);
        return processCancelReasons(orders);
      }
    },
    enabled: enabled && !!shopId && !!userId && !!dateRange,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    data: data || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  };
}

/**
 * Combined hook for backward compatibility - uses lazy loading internally
 */
export function useOrderReportsLazy(
  shopId: number,
  userId: string,
  dateRange: CustomDateRange | null,
  activeTab: OrderReportTab = 'created'
) {
  const queryClient = useQueryClient();

  // Only fetch data for the active tab
  const { totals, loading: totalsLoading } = useOrderReportsTotals(shopId, userId, dateRange);

  const { data: dailyStats, loading: createdLoading } = useOrderReportsCreated(
    shopId, userId, dateRange, activeTab === 'created'
  );

  const { data: dailyCompletedStats, loading: completedLoading } = useOrderReportsCompleted(
    shopId, userId, dateRange, activeTab === 'completed'
  );

  const { valueRanges, quantityRanges, loading: valueLoading } = useOrderReportsValue(
    shopId, userId, dateRange, activeTab === 'value'
  );

  const [productPage, setProductPage] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<'quantity' | 'name' | 'completed' | 'cancelled'>('quantity');

  const { items: productItems, total: productTotal, totalPages: productTotalPages, loading: productLoading } = useOrderReportsProducts(
    shopId, userId, dateRange,
    { page: productPage, pageSize: 50, search: productSearch, sort: productSort },
    activeTab === 'product'
  );

  const { statusBreakdown, dailyStatusStats, loading: statusLoading } = useOrderReportsStatus(
    shopId, userId, dateRange, activeTab === 'status'
  );

  const { data: cancelReasons, loading: cancelLoading } = useOrderReportsCancel(
    shopId, userId, dateRange, activeTab === 'cancel'
  );

  // Determine loading state based on active tab
  const loading = useMemo(() => {
    if (totalsLoading) return true;
    switch (activeTab) {
      case 'created': return createdLoading;
      case 'completed': return completedLoading;
      case 'value': return valueLoading;
      case 'product': return productLoading;
      case 'status': return statusLoading;
      case 'cancel': return cancelLoading;
      default: return false;
    }
  }, [activeTab, totalsLoading, createdLoading, completedLoading, valueLoading, productLoading, statusLoading, cancelLoading]);

  // Prefetch next likely tab
  const prefetchTab = useCallback((tab: OrderReportTab) => {
    if (!shopId || !userId || !dateRange) return;

    switch (tab) {
      case 'created':
        queryClient.prefetchQuery({
          queryKey: ['order-reports-created', shopId, userId, dateRange.from.getTime(), dateRange.to.getTime()],
          staleTime: STALE_TIME,
        });
        break;
      case 'completed':
        queryClient.prefetchQuery({
          queryKey: ['order-reports-completed', shopId, userId, dateRange.from.getTime(), dateRange.to.getTime()],
          staleTime: STALE_TIME,
        });
        break;
      // Add more as needed
    }
  }, [shopId, userId, dateRange, queryClient]);

  return {
    // Data
    dailyStats,
    dailyCompletedStats,
    valueRanges,
    quantityRanges,
    productItems,
    productTotal,
    productTotalPages,
    statusBreakdown,
    dailyStatusStats,
    cancelReasons,
    totals,

    // Loading states
    loading,

    // Product pagination
    productPage,
    setProductPage,
    productSearch,
    setProductSearch,
    productSort,
    setProductSort,

    // Utilities
    prefetchTab,
  };
}
