/**
 * Supabase Edge Function: Order Reports Aggregation
 * Server-side aggregation cho báo cáo đơn hàng
 *
 * Endpoints:
 * - GET/POST với tab parameter để lazy load từng loại báo cáo
 *
 * Tabs:
 * - created: Thống kê đơn tạo theo ngày
 * - completed: Thống kê đơn hoàn thành theo ngày
 * - value: Thống kê theo giá trị đơn hàng
 * - product: Thống kê theo sản phẩm (có pagination)
 * - status: Thống kê theo trạng thái
 * - cancel: Thống kê lý do hủy
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Value ranges for aggregation
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

// Format timestamp to date string with timezone offset
// timezoneOffset: hours offset from UTC (e.g., 7 for Vietnam UTC+7)
function formatLocalDate(timestamp: number, timezoneOffset: number = 7): string {
  // Add timezone offset to convert from UTC to local time
  const adjustedTimestamp = timestamp + (timezoneOffset * 3600);
  const date = new Date(adjustedTimestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get parameters
    let params: Record<string, string | number | undefined>;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      params = Object.fromEntries(url.searchParams.entries());
    } else {
      params = await req.json();
    }

    const shopId = Number(params.shop_id);
    const startTs = Number(params.start_ts);
    const endTs = Number(params.end_ts);
    const tab = String(params.tab || 'all');
    const page = Number(params.page || 1);
    const pageSize = Number(params.page_size || 50);
    const search = String(params.search || '');
    const timezoneOffset = Number(params.timezone_offset || 7); // Default to Vietnam UTC+7

    if (!shopId || !startTs || !endTs) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: shop_id, start_ts, end_ts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
        console.error('[order-reports] Query error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      return new Response(
        JSON.stringify({
          tab,
          data: getEmptyResponse(tab),
          totals: { created: 0, completed: 0, cancelled: 0, totalRevenue: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[order-reports] Fetched ${orders.length} orders total for tab: ${tab}`);

    // Process based on tab
    let result: unknown;
    let totals = { created: 0, completed: 0, cancelled: 0, totalRevenue: 0 };

    // Calculate totals
    orders.forEach((order) => {
      totals.created++;
      if (order.order_status === 'COMPLETED') {
        totals.completed++;
        totals.totalRevenue += order.total_amount || 0;
      }
      if (order.order_status === 'CANCELLED' || order.order_status === 'IN_CANCEL') {
        totals.cancelled++;
      }
    });

    switch (tab) {
      case 'created':
        result = aggregateDailyCreated(orders, startTs, endTs, timezoneOffset);
        break;
      case 'completed': {
        // For completed tab, also fetch return orders by update_time
        // These are orders that were created before the date range but returned during this period
        let returnOrders: typeof orders = [];
        let returnOffset = 0;
        let hasMoreReturns = true;

        while (hasMoreReturns) {
          const { data: returnBatch, error: returnError } = await supabase
            .from('apishopee_orders')
            .select('*')
            .eq('shop_id', shopId)
            .eq('order_status', 'TO_RETURN')
            .gte('update_time', startTs)
            .lte('update_time', endTs)
            .order('update_time', { ascending: true })
            .range(returnOffset, returnOffset + BATCH_SIZE - 1);

          if (returnError) {
            console.error('[order-reports] Return orders query error:', returnError);
            break;
          }

          if (!returnBatch || returnBatch.length === 0) {
            hasMoreReturns = false;
          } else {
            returnOrders = [...returnOrders, ...returnBatch];
            returnOffset += BATCH_SIZE;
            hasMoreReturns = returnBatch.length === BATCH_SIZE;
          }
        }

        // Merge orders, avoiding duplicates (orders that were created AND returned in the same period)
        const orderSns = new Set(orders.map((o: { order_sn: string }) => o.order_sn));
        const uniqueReturnOrders = returnOrders.filter((o: { order_sn: string }) => !orderSns.has(o.order_sn));
        const mergedOrders = [...orders, ...uniqueReturnOrders];

        console.log(`[order-reports] Fetched ${returnOrders.length} return orders, ${uniqueReturnOrders.length} unique`);

        result = aggregateDailyCompleted(mergedOrders, startTs, endTs, timezoneOffset);
        break;
      }
      case 'value':
        result = aggregateValueRanges(orders);
        break;
      case 'product':
        result = aggregateProducts(orders, page, pageSize, search);
        break;
      case 'status':
        result = aggregateStatus(orders, startTs, endTs, timezoneOffset);
        break;
      case 'cancel':
        result = aggregateCancelReasons(orders);
        break;
      default:
        // Return all aggregations
        result = {
          dailyCreated: aggregateDailyCreated(orders, startTs, endTs, timezoneOffset),
          dailyCompleted: aggregateDailyCompleted(orders, startTs, endTs, timezoneOffset),
          valueRanges: aggregateValueRanges(orders),
          products: aggregateProducts(orders, 1, 100, ''),
          statusBreakdown: aggregateStatus(orders, startTs, endTs, timezoneOffset),
          cancelReasons: aggregateCancelReasons(orders),
        };
    }

    return new Response(
      JSON.stringify({ tab, data: result, totals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[order-reports] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getEmptyResponse(tab: string) {
  switch (tab) {
    case 'created':
    case 'completed':
    case 'status':
      return [];
    case 'value':
      return { valueRanges: [], quantityRanges: [] };
    case 'product':
      return { items: [], total: 0, page: 1, pageSize: 50 };
    case 'cancel':
      return [];
    default:
      return {};
  }
}

// Aggregate daily created orders
function aggregateDailyCreated(orders: Record<string, unknown>[], startTs: number, endTs: number, timezoneOffset: number = 7) {
  const dailyMap = new Map<string, {
    date: string;
    created: number;
    createdProductQty: number;
    createdRevenue: number;
    createdShippingFee: number;
    completed: number;
    completedProductQty: number;
    completedRevenue: number;
    completedShippingFee: number;
    completedBuyerShippingFee: number;
    cancelled: number;
  }>();

  // Initialize all dates using timezone-aware calculation
  // Convert startTs to local date, then iterate by days
  const startDateStr = formatLocalDate(startTs, timezoneOffset);
  const endDateStr = formatLocalDate(endTs, timezoneOffset);

  // Parse the date strings back to iterate
  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  const currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (currentDate <= endDate) {
    const dateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
    dailyMap.set(dateStr, {
      date: dateStr,
      created: 0,
      createdProductQty: 0,
      createdRevenue: 0,
      createdShippingFee: 0,
      completed: 0,
      completedProductQty: 0,
      completedRevenue: 0,
      completedShippingFee: 0,
      completedBuyerShippingFee: 0,
      cancelled: 0,
    });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Aggregate orders
  orders.forEach((order) => {
    const createDate = formatLocalDate(order.create_time as number, timezoneOffset);
    const daily = dailyMap.get(createDate);
    if (!daily) return;

    const itemList = order.item_list as Array<{ model_quantity_purchased?: number }> | undefined;
    const productQty = itemList?.reduce((sum, item) => sum + (item.model_quantity_purchased || 1), 0) || 0;
    const shippingFee = (order.actual_shipping_fee || order.estimated_shipping_fee || 0) as number;
    const buyerShippingFee = (order.buyer_paid_shipping_fee || order.estimated_shipping_fee || 0) as number;
    const revenue = (order.total_amount || 0) as number;
    const status = order.order_status as string;

    daily.created++;
    daily.createdProductQty += productQty;
    daily.createdRevenue += revenue;
    daily.createdShippingFee += shippingFee;

    if (status === 'COMPLETED') {
      daily.completed++;
      daily.completedProductQty += productQty;
      daily.completedRevenue += revenue;
      daily.completedShippingFee += shippingFee;
      daily.completedBuyerShippingFee += buyerShippingFee;
    }

    if (status === 'CANCELLED' || status === 'IN_CANCEL') {
      daily.cancelled++;
    }
  });

  // Calculate derived fields and return
  return Array.from(dailyMap.values()).map((day) => ({
    ...day,
    createdAvgOrderValue: day.created > 0 ? Math.round(day.createdRevenue / day.created) : 0,
    createdProfit: Math.round(day.createdRevenue * 0.48 - day.createdShippingFee * 0.1),
    completedProfit: Math.round(day.completedRevenue * 0.48 - day.completedShippingFee * 0.1),
    cvr: day.created > 0 ? Math.round((day.completed / day.created) * 10000) / 100 : 0,
    revenue: day.completedRevenue, // Legacy field
  }));
}

// Aggregate daily completed orders (by completion date)
function aggregateDailyCompleted(orders: Record<string, unknown>[], startTs: number, endTs: number, timezoneOffset: number = 7) {
  const dailyMap = new Map<string, {
    date: string;
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
  }>();

  // Initialize all dates using timezone-aware calculation
  const startDateStr = formatLocalDate(startTs, timezoneOffset);
  const endDateStr = formatLocalDate(endTs, timezoneOffset);

  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  const currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (currentDate <= endDate) {
    const dateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
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
    });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Aggregate completed orders by update_time (giao thành công)
  orders.forEach((order) => {
    if (order.order_status !== 'COMPLETED') return;
    if (!order.update_time) return;

    const completedDate = formatLocalDate(order.update_time as number, timezoneOffset);
    const daily = dailyMap.get(completedDate);
    if (!daily) return;

    const itemList = order.item_list as Array<{ model_quantity_purchased?: number }> | undefined;
    const productQty = itemList?.reduce((sum, item) => sum + (item.model_quantity_purchased || 1), 0) || 0;
    const totalAmount = (order.total_amount || 0) as number;
    const buyerPaidShipping = (order.buyer_paid_shipping_fee || 0) as number;
    const actualShipping = (order.actual_shipping_fee || order.estimated_shipping_fee || 0) as number;
    const codFee = (order.cod_fee || 0) as number;
    const insuranceFee = (order.insurance_fee || 0) as number;
    const serviceFee = (order.service_fee || order.shopee_fee || 0) as number;
    const transactionFee = (order.transaction_fee || order.card_txn_fee || 0) as number;
    const commission = (order.commission_fee || order.seller_discount || 0) as number;
    const pointsUsed = (order.coins || order.voucher_from_seller || 0) as number;
    const bankTransfer = (order.buyer_txn_fee || 0) as number;

    daily.orderCount++;
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

  // Aggregate return orders by update_time (trả thành công)
  orders.forEach((order) => {
    if (order.order_status !== 'TO_RETURN') return;
    if (!order.update_time) return;

    const returnDate = formatLocalDate(order.update_time as number, timezoneOffset);
    const daily = dailyMap.get(returnDate);
    if (!daily) return;

    daily.returnCount++;
  });

  return Array.from(dailyMap.values()).map((day, index) => ({
    ...day,
    rowNum: index + 1,
    completed: day.orderCount,
  }));
}

// Aggregate value ranges
function aggregateValueRanges(orders: Record<string, unknown>[]) {
  const completedOrders = orders.filter((o) => o.order_status === 'COMPLETED');
  const totalCompleted = completedOrders.length;

  // Value ranges
  const valueRangeCounts = VALUE_RANGES.map(() => 0);
  const valueRangeRevenues = VALUE_RANGES.map(() => 0);

  // Quantity ranges
  const quantityRangeCounts = QUANTITY_RANGES.map(() => 0);

  completedOrders.forEach((order) => {
    const amount = (order.total_amount || 0) as number;
    const itemList = order.item_list as Array<{ model_quantity_purchased?: number }> | undefined;
    const productQty = itemList?.reduce((sum, item) => sum + (item.model_quantity_purchased || 1), 0) || 0;

    // Value range
    for (let i = 0; i < VALUE_RANGES.length; i++) {
      if (amount >= VALUE_RANGES[i].min && amount < VALUE_RANGES[i].max) {
        valueRangeCounts[i]++;
        valueRangeRevenues[i] += amount;
        break;
      }
    }

    // Quantity range
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

// Aggregate products with pagination
function aggregateProducts(
  orders: Record<string, unknown>[],
  page: number,
  pageSize: number,
  search: string
) {
  const productMap = new Map<number, {
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

  // Aggregate all orders
  orders.forEach((order) => {
    const itemList = order.item_list as Array<{
      item_id: number;
      item_name: string;
      image_info?: { image_url: string };
      model_quantity_purchased: number;
      model_discounted_price: number;
    }> | undefined;

    if (!itemList) return;

    const status = order.order_status as string;

    itemList.forEach((item) => {
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

  // Convert to array and calculate percentages
  let products = Array.from(productMap.values()).map((p) => ({
    ...p,
    cancelledPercent: p.ordersSP > 0 ? Math.round((p.cancelledSP / p.ordersSP) * 10000) / 100 : 0,
    completedPercent: p.ordersSP > 0 ? Math.round((p.completedSP / p.ordersSP) * 10000) / 100 : 0,
    returnsPercent: p.ordersSP > 0 ? Math.round((p.returnsSP / p.ordersSP) * 10000) / 100 : 0,
    notShippedPercent: p.ordersSP > 0 ? Math.round((p.notShippedSP / p.ordersSP) * 10000) / 100 : 0,
  }));

  // Filter by search
  if (search) {
    const searchLower = search.toLowerCase();
    products = products.filter((p) => p.itemName.toLowerCase().includes(searchLower));
  }

  // Sort by ordersSP descending
  products.sort((a, b) => b.ordersSP - a.ordersSP);

  const total = products.length;

  // Paginate
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

// Aggregate status breakdown
function aggregateStatus(orders: Record<string, unknown>[], startTs: number, endTs: number, timezoneOffset: number = 7) {
  const statusMap = new Map<string, { count: number; revenue: number }>();
  const dailyStatusMap = new Map<string, {
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
  }>();

  // Initialize all dates using timezone-aware calculation
  const startDateStr = formatLocalDate(startTs, timezoneOffset);
  const endDateStr = formatLocalDate(endTs, timezoneOffset);

  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  const currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

  while (currentDate <= endDate) {
    const dateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
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
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  orders.forEach((order) => {
    const status = (order.order_status || 'UNKNOWN') as string;
    const revenue = (order.total_amount || 0) as number;
    const createDate = formatLocalDate(order.create_time as number, timezoneOffset);

    // Status breakdown
    const entry = statusMap.get(status) || { count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += revenue;
    statusMap.set(status, entry);

    // Daily status
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

// Aggregate cancel reasons
function aggregateCancelReasons(orders: Record<string, unknown>[]) {
  const cancelReasonMap = new Map<string, { systemCount: number; returnedCount: number }>();

  const cancelledOrders = orders.filter(
    (o) => o.order_status === 'CANCELLED' || o.order_status === 'IN_CANCEL'
  );

  cancelledOrders.forEach((order) => {
    const reason = (order.buyer_cancel_reason || order.cancel_reason || 'other') as string;
    const cancelBy = (order.cancel_by || 'unknown') as string;

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
