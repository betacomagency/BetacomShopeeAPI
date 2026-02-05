/**
 * useOrderReports - Hook for order analytics/reports
 * Provides aggregated data for various report types
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DateRangeOption } from './useDashboardData';

// ==================== INTERFACES ====================

export interface DailyOrderStats {
  date: string;
  // All orders created on this day
  created: number;
  createdProductQty: number;
  createdRevenue: number; // total_amount of all orders
  createdShippingFee: number; // actual_shipping_fee
  createdAvgOrderValue: number;
  createdProfit: number;
  // Completed orders that were created on this day
  completed: number;
  completedProductQty: number;
  completedRevenue: number;
  completedShippingFee: number; // actual_shipping_fee
  completedBuyerShippingFee: number; // buyer paid shipping
  completedProfit: number;
  cvr: number; // conversion rate %
  // Cancelled orders
  cancelled: number;
  // Legacy field for backward compatibility
  revenue: number;
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

export interface ProductStats {
  itemId: number;
  itemName: string;
  imageUrl: string | null;
  quantity: number;
  revenue: number;
  orderCount: number;
}

// Detailed product stats with order status breakdown
export interface ProductDetailedStats {
  itemId: number;
  itemName: string;
  imageUrl: string | null;
  price: number; // Giá bán
  // Đặt hàng (All orders)
  ordersCount: number;     // Số đơn
  ordersSP: number;        // Số sản phẩm
  // Hủy (Cancelled)
  cancelledOrders: number;
  cancelledSP: number;
  cancelledPercent: number;
  // Đang chuyển (Shipping: SHIPPED, READY_TO_SHIP, TO_CONFIRM_RECEIVE)
  shippingOrders: number;
  shippingSP: number;
  // Thành công (Completed)
  completedOrders: number;
  completedSP: number;
  completedPercent: number;
  // Chuyển hoàn (Returns: TO_RETURN)
  returnsOrders: number;
  returnsSP: number;
  returnsPercent: number;
  // Chưa gửi HVC (Not shipped: UNPAID, PROCESSED, PENDING)
  notShippedOrders: number;
  notShippedSP: number;
  notShippedPercent: number;
}

export interface CategoryStats {
  category: string;
  quantity: number;
  revenue: number;
  orderCount: number;
  percent: number;
}

export interface StatusStats {
  status: string;
  statusLabel: string;
  count: number;
  revenue: number;
  percent: number;
}

export interface RegionStats {
  region: string;
  city: string;
  count: number;
  revenue: number;
  percent: number;
}

export interface CancelReasonStats {
  reason: string;
  systemCount: number;     // Hệ thống hủy (cancel_by != 'buyer')
  returnedCount: number;   // Đã hoàn (TO_RETURN or refund-related)
  totalCount: number;      // Tổng số
  systemPercent: number;
  returnedPercent: number;
  totalPercent: number;
}

// Daily status breakdown for status tab
export interface DailyStatusStats {
  date: string;
  // Xác nhận (UNPAID, PENDING)
  confirmedCount: number;
  confirmedAmount: number;
  // Đóng gói (PROCESSED, READY_TO_SHIP)
  packagingCount: number;
  packagingAmount: number;
  // Đang chuyển (SHIPPED, TO_CONFIRM_RECEIVE)
  shippingCount: number;
  shippingAmount: number;
  // Thất bại (delivery failed but not cancelled)
  failedCount: number;
  failedAmount: number;
  // Thành công (COMPLETED)
  completedCount: number;
  completedAmount: number;
  // Hủy (CANCELLED, IN_CANCEL)
  cancelledCount: number;
  cancelledAmount: number;
  // Chuyển hoàn (TO_RETURN)
  returnsCount: number;
  returnsAmount: number;
  // Tổng
  totalCount: number;
  totalAmount: number;
}

export interface DailyCompletedStats {
  date: string;
  rowNum: number;
  // Basic counts
  productQty: number;       // [1] SLSP - Số lượng sản phẩm
  orderCount: number;       // [2] SL đơn
  itemCount: number;        // [3] Số item
  // Financial
  totalSales: number;       // [4] Tổng bán
  totalRefund: number;      // [5] Tổng trả
  vat: number;              // [6] VAT
  buyerShippingFee: number; // [7] PSBK - Phí ship báo khách
  shippingFee: number;      // [8] PVC - Phí vận chuyển thực tế
  codFee: number;           // [9] PTTH - Phí thu hộ COD
  insuranceFee: number;     // [9A] PBH - Phí bảo hiểm
  feeDiff: number;          // [10] Chênh phí = [7] - [8] - [9]
  bankTransfer: number;     // [11] Chuyển khoản
  serviceFee: number;       // [12] PCH - Phí cố định Shopee
  transactionFee: number;   // [13] PVC - Phí giao dịch
  commission: number;       // [14] Chiết khấu
  pointsUsed: number;       // [14A] SD điểm
  deposit: number;          // [15] Đặt cọc
  revenue: number;          // [16] Doanh thu = [4] - [5] - [14] - [14A]
  actualReceived: number;   // [17] Thực thu = [7] + [6] + [16] - [11]
  actualPaid: number;       // [18] Thực trả = [7] + [6] + [16] - [8] - [9] - [9A] - [11] - [12] - [13]
  // Legacy
  completed: number;
}

export interface OrderReportsData {
  dailyStats: DailyOrderStats[];
  dailyCompletedStats: DailyCompletedStats[]; // Grouped by completion date (update_time)
  dailyStatusStats: DailyStatusStats[]; // Daily breakdown by order status
  valueRanges: OrderValueRange[];
  quantityRanges: QuantityRangeStats[];
  topProducts: ProductStats[];
  productDetailedStats: ProductDetailedStats[]; // Product stats with order status breakdown
  statusBreakdown: StatusStats[];
  regionBreakdown: RegionStats[];
  cancelReasons: CancelReasonStats[];
  totals: {
    created: number;
    completed: number;
    cancelled: number;
    totalRevenue: number;
  };
}

// Status label mapping
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

// Cancel reason label mapping
const CANCEL_REASON_LABELS: Record<string, string> = {
  'buyer_request': 'Người mua yêu cầu',
  'out_of_stock': 'Hết hàng',
  'customer_request': 'Khách hàng yêu cầu',
  'unable_to_deliver': 'Không thể giao hàng',
  'wrong_price': 'Giá sai',
  'duplicate_order': 'Đơn trùng',
  'seller_request': 'Người bán yêu cầu',
  'system_cancel': 'Hệ thống hủy',
  'other': 'Lý do khác',
};

// Date range helpers
function getDateRange(option: DateRangeOption): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let start: Date;
  let end: Date;

  switch (option) {
    case 'today': {
      start = new Date(today);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      end = new Date(today);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '7days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '14days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 13);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case '30days': {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(today);
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'last_week': {
      const dayOfWeek2 = today.getDay();
      const diffToMonday2 = dayOfWeek2 === 0 ? 6 : dayOfWeek2 - 1;
      end = new Date(today);
      end.setDate(end.getDate() - diffToMonday2 - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    default: {
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 13);
      start.setHours(0, 0, 0, 0);
    }
  }

  return { start, end };
}

function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Default empty data
const DEFAULT_DATA: OrderReportsData = {
  dailyStats: [],
  dailyCompletedStats: [],
  dailyStatusStats: [],
  valueRanges: [],
  quantityRanges: [],
  topProducts: [],
  productDetailedStats: [],
  statusBreakdown: [],
  regionBreakdown: [],
  cancelReasons: [],
  totals: {
    created: 0,
    completed: 0,
    cancelled: 0,
    totalRevenue: 0,
  },
};

// Value ranges definition (5 ranges)
const VALUE_RANGES = [
  { label: '< 200.000', min: 0, max: 200000 },
  { label: '200.000 - 500.000', min: 200000, max: 500000 },
  { label: '500.000 - 1.000.000', min: 500000, max: 1000000 },
  { label: '1.000.000 - 2.000.000', min: 1000000, max: 2000000 },
  { label: '> 2.000.000', min: 2000000, max: Infinity },
];

// Product quantity ranges
const QUANTITY_RANGES = [
  { label: '=> 1', min: 1, max: 1 },
  { label: '<= 2', min: 2, max: 2 },
  { label: '1 => 3', min: 3, max: 3 },
  { label: '2 => 4', min: 4, max: 4 },
  { label: '3 => 5', min: 5, max: 5 },
  { label: '5 => 7', min: 6, max: 7 },
  { label: '8 => 10', min: 8, max: 10 },
  { label: '> 10', min: 11, max: Infinity },
];

/**
 * Custom date range for hook
 */
export interface CustomDateRange {
  from: Date;
  to: Date;
}

/**
 * Hook for order reports data
 * Supports both preset date ranges and custom date ranges
 */
export function useOrderReports(
  shopId: number,
  userId: string,
  dateRange: DateRangeOption | null = '14days',
  customRange?: CustomDateRange
) {
  // Create a stable key for custom ranges
  const customRangeKey = customRange
    ? `${customRange.from.getTime()}-${customRange.to.getTime()}`
    : null;

  const queryKey = useMemo(
    () => ['order-reports', shopId, userId, dateRange, customRangeKey],
    [shopId, userId, dateRange, customRangeKey]
  );

  const fetchReportsData = useCallback(async (): Promise<OrderReportsData> => {
    if (!shopId || !userId) return DEFAULT_DATA;

    let start: Date;
    let end: Date;

    if (customRange) {
      // Use custom date range
      start = new Date(customRange.from);
      start.setHours(0, 0, 0, 0);
      end = new Date(customRange.to);
      end.setHours(23, 59, 59, 999);
    } else if (dateRange) {
      // Use preset date range
      const range = getDateRange(dateRange);
      start = range.start;
      end = range.end;
    } else {
      return DEFAULT_DATA;
    }

    const startTs = toUnixTimestamp(start);
    const endTs = toUnixTimestamp(end);

    // Fetch ALL orders using pagination (Supabase default limit is 1000)
    const BATCH_SIZE = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allOrders: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('apishopee_orders')
        .select('*')
        .eq('shop_id', shopId)
        .gte('create_time', startTs)
        .lte('create_time', endTs)
        .order('create_time', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('[useOrderReports] Error fetching orders:', error);
        throw new Error(error.message);
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allOrders = [...allOrders, ...batch];
        offset += BATCH_SIZE;
        // If we got fewer than BATCH_SIZE, we've reached the end
        hasMore = batch.length === BATCH_SIZE;
      }
    }

    const orders = allOrders;

    if (!orders || orders.length === 0) {
      return DEFAULT_DATA;
    }

    console.log(`[useOrderReports] Fetched ${orders.length} orders total`);

    // Initialize daily stats map (by create_time)
    const dailyMap = new Map<string, DailyOrderStats>();
    // Initialize daily completed stats map (by update_time/completion date)
    const dailyCompletedMap = new Map<string, DailyCompletedStats>();
    // Initialize daily status stats map (by create_time)
    const dailyStatusMap = new Map<string, DailyStatusStats>();

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = formatLocalDate(currentDate);
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
      dailyCompletedMap.set(dateStr, {
        date: dateStr,
        rowNum: 0,
        productQty: 0,
        orderCount: 0,
        itemCount: 0,
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
      dailyStatusMap.set(dateStr, {
        date: dateStr,
        confirmedCount: 0,
        confirmedAmount: 0,
        packagingCount: 0,
        packagingAmount: 0,
        shippingCount: 0,
        shippingAmount: 0,
        failedCount: 0,
        failedAmount: 0,
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

    // Initialize aggregation objects
    const statusMap = new Map<string, { count: number; revenue: number }>();
    const regionMap = new Map<string, { count: number; revenue: number }>();
    const cancelReasonMap = new Map<string, { systemCount: number; returnedCount: number }>();
    const productMap = new Map<number, ProductStats>();
    // Detailed product stats map (tracks all order statuses per product)
    const productDetailedMap = new Map<number, {
      itemId: number;
      itemName: string;
      imageUrl: string | null;
      price: number;
      ordersCount: number;
      ordersSP: number;
      cancelledOrders: number;
      cancelledSP: number;
      shippingOrders: number;
      shippingSP: number;
      completedOrders: number;
      completedSP: number;
      returnsOrders: number;
      returnsSP: number;
      notShippedOrders: number;
      notShippedSP: number;
    }>();
    const valueRangeCounts: number[] = VALUE_RANGES.map(() => 0);
    const valueRangeRevenues: number[] = VALUE_RANGES.map(() => 0);
    const quantityRangeCounts: number[] = QUANTITY_RANGES.map(() => 0);

    let totalCreated = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;
    let totalRevenue = 0;

    // Process each order
    orders.forEach((order) => {
      const createDate = new Date(order.create_time * 1000);
      const dateStr = formatLocalDate(createDate);
      const daily = dailyMap.get(dateStr);

      // Calculate product quantity from item_list
      const productQty = order.item_list?.reduce((sum: number, item: { model_quantity_purchased?: number }) =>
        sum + (item.model_quantity_purchased || 1), 0) || 0;

      // Get shipping fees
      const actualShippingFee = order.actual_shipping_fee || order.estimated_shipping_fee || 0;
      const buyerShippingFee = order.buyer_paid_shipping_fee || order.estimated_shipping_fee || 0;
      const orderRevenue = order.total_amount || 0;

      // Estimate profit (simplified: ~48% of revenue after shipping)
      const estimatedProfit = Math.max(0, orderRevenue * 0.48 - actualShippingFee * 0.1);

      totalCreated++;
      if (daily) {
        daily.created++;
        daily.createdProductQty += productQty;
        daily.createdRevenue += orderRevenue;
        daily.createdShippingFee += actualShippingFee;
      }

      // Status aggregation
      const status = order.order_status || 'UNKNOWN';
      const statusEntry = statusMap.get(status) || { count: 0, revenue: 0 };
      statusEntry.count++;
      statusEntry.revenue += orderRevenue;
      statusMap.set(status, statusEntry);

      // Daily status aggregation
      const dailyStatus = dailyStatusMap.get(dateStr);
      if (dailyStatus) {
        dailyStatus.totalCount++;
        dailyStatus.totalAmount += orderRevenue;

        // Categorize by status
        if (status === 'UNPAID' || status === 'PENDING' || status === 'INVOICE_PENDING') {
          dailyStatus.confirmedCount++;
          dailyStatus.confirmedAmount += orderRevenue;
        } else if (status === 'PROCESSED' || status === 'READY_TO_SHIP') {
          dailyStatus.packagingCount++;
          dailyStatus.packagingAmount += orderRevenue;
        } else if (status === 'SHIPPED' || status === 'TO_CONFIRM_RECEIVE') {
          dailyStatus.shippingCount++;
          dailyStatus.shippingAmount += orderRevenue;
        } else if (status === 'COMPLETED') {
          dailyStatus.completedCount++;
          dailyStatus.completedAmount += orderRevenue;
        } else if (status === 'CANCELLED' || status === 'IN_CANCEL') {
          dailyStatus.cancelledCount++;
          dailyStatus.cancelledAmount += orderRevenue;
        } else if (status === 'TO_RETURN') {
          dailyStatus.returnsCount++;
          dailyStatus.returnsAmount += orderRevenue;
        } else {
          // Other statuses go to failed
          dailyStatus.failedCount++;
          dailyStatus.failedAmount += orderRevenue;
        }
      }

      // Count completed
      if (status === 'COMPLETED') {
        totalCompleted++;
        // Track by creation date
        if (daily) {
          daily.completed++;
          daily.completedProductQty += productQty;
          daily.completedRevenue += orderRevenue;
          daily.completedShippingFee += actualShippingFee;
          daily.completedBuyerShippingFee += buyerShippingFee;
          daily.completedProfit += estimatedProfit;
          daily.revenue += orderRevenue; // Legacy field
        }
        totalRevenue += orderRevenue;

        // Track by completion date (using update_time)
        if (order.update_time) {
          const completedDate = new Date(order.update_time * 1000);
          const completedDateStr = formatLocalDate(completedDate);
          const dailyCompleted = dailyCompletedMap.get(completedDateStr);
          if (dailyCompleted) {
            dailyCompleted.completed++;
            dailyCompleted.orderCount++;
            dailyCompleted.productQty += productQty;
            dailyCompleted.itemCount += order.item_list?.length || 0;

            // Financial calculations
            const totalAmount = order.total_amount || 0;
            const escrowAmount = order.escrow_amount || totalAmount;
            const buyerPaidShipping = order.buyer_paid_shipping_fee || 0;
            const actualShipping = order.actual_shipping_fee || order.estimated_shipping_fee || 0;
            const codFee = order.cod_fee || 0;
            const insuranceFee = order.insurance_fee || 0;
            const serviceFee = order.service_fee || order.shopee_fee || 0;
            const transactionFee = order.transaction_fee || order.card_txn_fee || 0;
            const commission = order.commission_fee || order.seller_discount || 0;
            const pointsUsed = order.coins || order.voucher_from_seller || 0;
            const bankTransfer = order.buyer_txn_fee || 0;

            dailyCompleted.totalSales += totalAmount;
            dailyCompleted.buyerShippingFee += buyerPaidShipping;
            dailyCompleted.shippingFee += actualShipping;
            dailyCompleted.codFee += codFee;
            dailyCompleted.insuranceFee += insuranceFee;
            dailyCompleted.serviceFee += serviceFee;
            dailyCompleted.transactionFee += transactionFee;
            dailyCompleted.commission += commission;
            dailyCompleted.pointsUsed += pointsUsed;
            dailyCompleted.bankTransfer += bankTransfer;

            // Fee difference = buyer shipping - actual shipping - cod fee
            const feeDiff = buyerPaidShipping - actualShipping - codFee;
            dailyCompleted.feeDiff += feeDiff;

            // Revenue = total sales - refund - commission - points
            const revenue = totalAmount - commission - pointsUsed;
            dailyCompleted.revenue += revenue;

            // Actual received = buyer shipping + VAT + revenue - bank transfer
            const actualReceived = buyerPaidShipping + revenue - bankTransfer;
            dailyCompleted.actualReceived += actualReceived;

            // Actual paid = buyer shipping + revenue - shipping - cod - insurance - bank - service - transaction
            const actualPaid = buyerPaidShipping + revenue - actualShipping - codFee - insuranceFee - bankTransfer - serviceFee - transactionFee;
            dailyCompleted.actualPaid += actualPaid;
          }
        }
      }

      // Count cancelled
      if (status === 'CANCELLED' || status === 'IN_CANCEL') {
        totalCancelled++;
        if (daily) {
          daily.cancelled++;
        }

        // Cancel reason - track by cancel type
        const reason = order.buyer_cancel_reason || order.cancel_reason || 'other';
        const cancelBy = order.cancel_by || 'unknown';
        const cancelEntry = cancelReasonMap.get(reason) || { systemCount: 0, returnedCount: 0 };

        // Categorize: system cancelled vs returned/refunded
        // "Hệ thống hủy" = cancel_by is not 'buyer' (system, seller, etc.)
        // "Đã hoàn" = buyer cancelled or return-related
        if (cancelBy === 'buyer' || cancelBy === 'customer') {
          cancelEntry.returnedCount++;
        } else {
          cancelEntry.systemCount++;
        }
        cancelReasonMap.set(reason, cancelEntry);
      }

      // Region aggregation (only for completed orders)
      if (status === 'COMPLETED' && order.recipient_address) {
        const addr = order.recipient_address;
        const region = addr.region || 'Không xác định';
        const city = addr.city || addr.state || addr.district || 'Không xác định';
        const key = `${region}|${city}`;
        const regionEntry = regionMap.get(key) || { count: 0, revenue: 0 };
        regionEntry.count++;
        regionEntry.revenue += order.total_amount || 0;
        regionMap.set(key, regionEntry);
      }

      // Value range aggregation (only for completed orders)
      if (status === 'COMPLETED') {
        const amount = order.total_amount || 0;
        for (let i = 0; i < VALUE_RANGES.length; i++) {
          if (amount >= VALUE_RANGES[i].min && amount < VALUE_RANGES[i].max) {
            valueRangeCounts[i]++;
            valueRangeRevenues[i] += amount;
            break;
          }
        }

        // Quantity range aggregation
        const orderProductQty = order.item_list?.reduce((sum: number, item: { model_quantity_purchased?: number }) =>
          sum + (item.model_quantity_purchased || 1), 0) || 0;
        for (let i = 0; i < QUANTITY_RANGES.length; i++) {
          const range = QUANTITY_RANGES[i];
          if (range.max === Infinity) {
            if (orderProductQty >= range.min) {
              quantityRangeCounts[i]++;
              break;
            }
          } else if (orderProductQty >= range.min && orderProductQty <= range.max) {
            quantityRangeCounts[i]++;
            break;
          }
        }
      }

      // Product aggregation (only for completed orders - for topProducts)
      if (status === 'COMPLETED' && order.item_list) {
        order.item_list.forEach((item: {
          item_id: number;
          item_name: string;
          image_info?: { image_url: string };
          model_quantity_purchased: number;
          model_discounted_price: number;
        }) => {
          const existing = productMap.get(item.item_id);
          const qty = item.model_quantity_purchased || 1;
          const revenue = (item.model_discounted_price || 0) * qty;

          if (existing) {
            existing.quantity += qty;
            existing.revenue += revenue;
            existing.orderCount++;
          } else {
            productMap.set(item.item_id, {
              itemId: item.item_id,
              itemName: item.item_name || 'Không tên',
              imageUrl: item.image_info?.image_url || null,
              quantity: qty,
              revenue,
              orderCount: 1,
            });
          }
        });
      }

      // Detailed product stats aggregation (ALL orders, by status)
      if (order.item_list) {
        order.item_list.forEach((item: {
          item_id: number;
          item_name: string;
          image_info?: { image_url: string };
          model_quantity_purchased: number;
          model_discounted_price: number;
        }) => {
          const qty = item.model_quantity_purchased || 1;
          const price = item.model_discounted_price || 0;

          let existing = productDetailedMap.get(item.item_id);
          if (!existing) {
            existing = {
              itemId: item.item_id,
              itemName: item.item_name || 'Không tên',
              imageUrl: item.image_info?.image_url || null,
              price: price,
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
            productDetailedMap.set(item.item_id, existing);
          }

          // Update totals
          existing.ordersCount++;
          existing.ordersSP += qty;
          // Update price if higher (use latest/highest price)
          if (price > existing.price) {
            existing.price = price;
          }

          // Categorize by order status
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
            // UNPAID, PROCESSED, PENDING, INVOICE_PENDING, etc.
            existing.notShippedOrders++;
            existing.notShippedSP += qty;
          }
        });
      }
    });

    // Calculate derived fields for each day
    dailyMap.forEach((daily) => {
      // Average order value
      daily.createdAvgOrderValue = daily.created > 0 ? Math.round(daily.createdRevenue / daily.created) : 0;
      // Estimated profit for all created orders (simplified)
      daily.createdProfit = Math.round(daily.createdRevenue * 0.48 - daily.createdShippingFee * 0.1);
      // CVR - Conversion rate
      daily.cvr = daily.created > 0 ? Math.round((daily.completed / daily.created) * 10000) / 100 : 0;
    });

    // Convert maps to arrays
    const dailyStats = Array.from(dailyMap.values());
    const dailyCompletedStats = Array.from(dailyCompletedMap.values())
      .map((day, index) => ({ ...day, rowNum: index + 1 }));

    const valueRanges: OrderValueRange[] = VALUE_RANGES.map((range, i) => ({
      range: range.label,
      min: range.min,
      max: range.max,
      count: valueRangeCounts[i],
      revenue: valueRangeRevenues[i],
      percent: totalCompleted > 0 ? Math.round((valueRangeCounts[i] / totalCompleted) * 10000) / 100 : 0,
    }));

    const quantityRanges: QuantityRangeStats[] = QUANTITY_RANGES.map((range, i) => ({
      range: range.label,
      min: range.min,
      max: range.max,
      count: quantityRangeCounts[i],
      percent: totalCompleted > 0 ? Math.round((quantityRangeCounts[i] / totalCompleted) * 10000) / 100 : 0,
    }));

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    // Build productDetailedStats with calculated percentages
    const productDetailedStats: ProductDetailedStats[] = Array.from(productDetailedMap.values())
      .map((p) => ({
        ...p,
        cancelledPercent: p.ordersSP > 0 ? Math.round((p.cancelledSP / p.ordersSP) * 10000) / 100 : 0,
        completedPercent: p.ordersSP > 0 ? Math.round((p.completedSP / p.ordersSP) * 10000) / 100 : 0,
        returnsPercent: p.ordersSP > 0 ? Math.round((p.returnsSP / p.ordersSP) * 10000) / 100 : 0,
        notShippedPercent: p.ordersSP > 0 ? Math.round((p.notShippedSP / p.ordersSP) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.ordersSP - a.ordersSP); // Sort by total quantity

    const statusBreakdown: StatusStats[] = Array.from(statusMap.entries())
      .map(([status, data]) => ({
        status,
        statusLabel: STATUS_LABELS[status] || status,
        count: data.count,
        revenue: data.revenue,
        percent: totalCreated > 0 ? Math.round((data.count / totalCreated) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const regionBreakdown: RegionStats[] = Array.from(regionMap.entries())
      .map(([key, data]) => {
        const [region, city] = key.split('|');
        return {
          region,
          city,
          count: data.count,
          revenue: data.revenue,
          percent: totalCompleted > 0 ? Math.round((data.count / totalCompleted) * 100) : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const cancelReasons: CancelReasonStats[] = Array.from(cancelReasonMap.entries())
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

    // Convert daily status map to array
    const dailyStatusStats: DailyStatusStats[] = Array.from(dailyStatusMap.values());

    return {
      dailyStats,
      dailyCompletedStats,
      dailyStatusStats,
      valueRanges,
      quantityRanges,
      topProducts,
      productDetailedStats,
      statusBreakdown,
      regionBreakdown,
      cancelReasons,
      totals: {
        created: totalCreated,
        completed: totalCompleted,
        cancelled: totalCancelled,
        totalRevenue,
      },
    };
  }, [shopId, userId, dateRange, customRange]);

  const { data, isLoading, error, refetch: queryRefetch } = useQuery({
    queryKey,
    queryFn: fetchReportsData,
    enabled: !!shopId && !!userId && (!!dateRange || !!customRange),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    data: data || DEFAULT_DATA,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
