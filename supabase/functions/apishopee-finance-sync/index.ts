/**
 * Supabase Edge Function: Shopee Finance Sync
 * Đồng bộ dòng tiền (escrow) từ Shopee API - "Tiền thực nhận"
 *
 * Logic nghiệp vụ:
 * - Chạy riêng biệt với Order Sync (mỗi 1 giờ)
 * - Query DB: Lấy các đơn có status = COMPLETED VÀ is_escrow_fetched = false
 * - Gọi API /api/v2/payment/get_escrow_detail cho từng đơn
 * - Lưu dữ liệu tài chính vào bảng apishopee_order_escrow
 * - Update is_escrow_fetched = true sau khi lấy xong
 *
 * Actions:
 * - sync: Sync escrow cho các đơn COMPLETED chưa fetch (default, for cron)
 * - sync-all: Force re-sync tất cả đơn COMPLETED
 * - stats: Thống kê số đơn cần fetch và đã fetch
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Constants
const BATCH_SIZE = 50; // Process 50 orders per batch
const RATE_LIMIT_DELAY = 100; // 100ms between API calls

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ==================== TYPES ====================

interface PartnerCredentials {
  partner_id: number;
  partner_key: string;
}

interface OrderForEscrow {
  order_sn: string;
  shop_id: number;
  order_status: string;
  total_amount: number;
  create_time: number;
}

interface EscrowData {
  order_sn: string;
  buyer_user_name?: string;
  return_order_sn_list?: string[];
  order_income: {
    escrow_amount: number;
    escrow_amount_after_adjustment?: number;
    buyer_total_amount: number;
    original_price: number;
    order_original_price?: number;
    order_discounted_price?: number;
    order_selling_price?: number;
    order_seller_discount?: number;
    seller_discount: number;
    shopee_discount: number;
    original_shopee_discount?: number;
    voucher_from_seller: number;
    voucher_from_shopee: number;
    coins: number;
    buyer_paid_shipping_fee: number;
    buyer_transaction_fee: number;
    estimated_shipping_fee?: number;
    final_shipping_fee?: number;
    actual_shipping_fee?: number;
    shopee_shipping_rebate?: number;
    shipping_fee_discount_from_3pl?: number;
    seller_shipping_discount?: number;
    reverse_shipping_fee?: number;
    shipping_fee_sst?: number;
    reverse_shipping_fee_sst?: number;
    commission_fee: number;
    service_fee: number;
    seller_transaction_fee: number;
    campaign_fee?: number;
    order_ams_commission_fee?: number;
    credit_card_promotion?: number;
    credit_card_transaction_fee?: number;
    payment_promotion?: number;
    net_commission_fee?: number;
    net_service_fee?: number;
    seller_order_processing_fee?: number;
    fbs_fee?: number;
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
    seller_lost_compensation?: number;
    seller_coin_cash_back?: number;
    seller_return_refund?: number;
    drc_adjustable_refund?: number;
    cost_of_goods_sold?: number;
    original_cost_of_goods_sold?: number;
    final_product_protection?: number;
    rsf_seller_protection_fee_claim_amount?: number;
    shipping_seller_protection_fee_amount?: number;
    delivery_seller_protection_fee_premium_amount?: number;
    overseas_return_service_fee?: number;
    total_adjustment_amount?: number;
    order_adjustment?: unknown[];
    buyer_payment_method?: string;
    instalment_plan?: string;
    seller_voucher_code?: string[];
    items?: unknown[];
  };
  buyer_payment_info?: {
    buyer_payment_method?: string;
    buyer_total_amount?: number;
    merchant_subtotal?: number;
    shipping_fee?: number;
    shopee_coins?: number;
    voucher?: number;
    buyer_service_fee?: number;
    buyer_paid_amount?: number;
    insurance_premium?: number;
    seller_rebate?: number;
    drc_adjustable_refund?: number;
    installment_info?: unknown;
  };
}

interface EscrowDetailResponse {
  error?: string;
  message?: string;
  response?: EscrowData;
}

// ==================== HELPER FUNCTIONS ====================

function generateSign(
  path: string,
  timestamp: number,
  accessToken: string,
  shopId: number,
  partnerId: number,
  partnerKey: string
): string {
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

async function getShopCredentialsAndToken(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<{ credentials: PartnerCredentials; token: { access_token: string; refresh_token: string } } | null> {
  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('partner_id, partner_key, access_token, refresh_token')
    .eq('shop_id', shopId)
    .single();

  if (error || !data) {
    console.error(`[FINANCE-SYNC] Failed to get shop data for shop ${shopId}:`, error);
    return null;
  }

  return {
    credentials: {
      partner_id: data.partner_id,
      partner_key: data.partner_key,
    },
    token: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    },
  };
}

async function callShopeeAPI(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  path: string,
  shopId: number,
  token: { access_token: string; refresh_token: string },
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(path, timestamp, token.access_token, shopId, credentials.partner_id, credentials.partner_key);

  const queryParams = new URLSearchParams({
    partner_id: credentials.partner_id.toString(),
    timestamp: timestamp.toString(),
    access_token: token.access_token,
    shop_id: shopId.toString(),
    sign,
  });

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        queryParams.set(key, JSON.stringify(value));
      } else {
        queryParams.set(key, String(value));
      }
    }
  });

  const url = `https://partner.shopeemobile.com${path}?${queryParams}`;

  const response = await fetch(url);
  return response.json();
}

async function fetchEscrowDetail(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  shopId: number,
  token: { access_token: string; refresh_token: string },
  orderSn: string
): Promise<EscrowData | null> {
  try {
    const result = await callShopeeAPI(
      supabase, credentials, '/api/v2/payment/get_escrow_detail', shopId, token,
      { order_sn: orderSn }
    ) as EscrowDetailResponse;

    if (result.error) {
      console.log(`[FINANCE-SYNC] get_escrow_detail error for ${orderSn}:`, result.message);
      return null;
    }

    return result.response || null;
  } catch (err) {
    console.log(`[FINANCE-SYNC] get_escrow_detail failed for ${orderSn}:`, (err as Error).message);
    return null;
  }
}

async function upsertEscrowData(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  escrowDataList: EscrowData[]
): Promise<number> {
  if (escrowDataList.length === 0) return 0;

  const records = escrowDataList.map(e => {
    const income = e.order_income;
    const buyerInfo = e.buyer_payment_info;

    return {
      shop_id: shopId,
      order_sn: e.order_sn,
      buyer_user_name: e.buyer_user_name,
      return_order_sn_list: e.return_order_sn_list || [],

      // Order Income fields
      escrow_amount: income.escrow_amount,
      escrow_amount_after_adjustment: income.escrow_amount_after_adjustment,
      buyer_total_amount: income.buyer_total_amount,
      original_price: income.original_price,
      order_original_price: income.order_original_price,
      order_discounted_price: income.order_discounted_price,
      order_selling_price: income.order_selling_price,
      order_seller_discount: income.order_seller_discount,
      seller_discount: income.seller_discount,
      shopee_discount: income.shopee_discount,
      original_shopee_discount: income.original_shopee_discount,
      voucher_from_seller: income.voucher_from_seller,
      voucher_from_shopee: income.voucher_from_shopee,
      coins: income.coins,

      // Shipping fees
      buyer_paid_shipping_fee: income.buyer_paid_shipping_fee,
      buyer_transaction_fee: income.buyer_transaction_fee,
      estimated_shipping_fee: income.estimated_shipping_fee,
      final_shipping_fee: income.final_shipping_fee,
      actual_shipping_fee: income.actual_shipping_fee,
      shopee_shipping_rebate: income.shopee_shipping_rebate,
      shipping_fee_discount_from_3pl: income.shipping_fee_discount_from_3pl,
      seller_shipping_discount: income.seller_shipping_discount,
      reverse_shipping_fee: income.reverse_shipping_fee,
      shipping_fee_sst: income.shipping_fee_sst,
      reverse_shipping_fee_sst: income.reverse_shipping_fee_sst,

      // Service fees & commissions
      commission_fee: income.commission_fee,
      service_fee: income.service_fee,
      seller_transaction_fee: income.seller_transaction_fee,
      campaign_fee: income.campaign_fee,
      order_ams_commission_fee: income.order_ams_commission_fee,
      credit_card_promotion: income.credit_card_promotion,
      credit_card_transaction_fee: income.credit_card_transaction_fee,
      payment_promotion: income.payment_promotion,
      net_commission_fee: income.net_commission_fee,
      net_service_fee: income.net_service_fee,
      seller_order_processing_fee: income.seller_order_processing_fee,
      fbs_fee: income.fbs_fee,

      // Taxes
      escrow_tax: income.escrow_tax,
      final_product_vat_tax: income.final_product_vat_tax,
      final_shipping_vat_tax: income.final_shipping_vat_tax,
      final_escrow_product_gst: income.final_escrow_product_gst,
      final_escrow_shipping_gst: income.final_escrow_shipping_gst,
      withholding_tax: income.withholding_tax,
      withholding_vat_tax: income.withholding_vat_tax,
      withholding_pit_tax: income.withholding_pit_tax,
      cross_border_tax: income.cross_border_tax,
      sales_tax_on_lvg: income.sales_tax_on_lvg,
      vat_on_imported_goods: income.vat_on_imported_goods,

      // Compensation & refunds
      seller_lost_compensation: income.seller_lost_compensation,
      seller_coin_cash_back: income.seller_coin_cash_back,
      seller_return_refund: income.seller_return_refund,
      drc_adjustable_refund: income.drc_adjustable_refund,
      cost_of_goods_sold: income.cost_of_goods_sold,
      original_cost_of_goods_sold: income.original_cost_of_goods_sold,
      final_product_protection: income.final_product_protection,

      // Insurance & additional fees
      rsf_seller_protection_fee_claim_amount: income.rsf_seller_protection_fee_claim_amount,
      shipping_seller_protection_fee_amount: income.shipping_seller_protection_fee_amount,
      delivery_seller_protection_fee_premium_amount: income.delivery_seller_protection_fee_premium_amount,
      overseas_return_service_fee: income.overseas_return_service_fee,

      // Adjustments
      total_adjustment_amount: income.total_adjustment_amount,
      order_adjustment: income.order_adjustment || [],

      // Payment info from order_income
      buyer_payment_method: income.buyer_payment_method,
      instalment_plan: income.instalment_plan,
      seller_voucher_code: income.seller_voucher_code || [],

      // Items
      items: income.items || [],

      // Buyer payment info - mapped to correct table columns
      buyer_payment_info_method: buyerInfo?.buyer_payment_method,
      buyer_payment_info_total_amount: buyerInfo?.buyer_total_amount,
      merchant_subtotal: buyerInfo?.merchant_subtotal,
      buyer_shipping_fee: buyerInfo?.shipping_fee,
      shopee_coins_redeemed: buyerInfo?.shopee_coins,
      buyer_seller_voucher: buyerInfo?.voucher,
      buyer_service_fee: buyerInfo?.buyer_service_fee,
      insurance_premium: buyerInfo?.insurance_premium,

      synced_at: new Date().toISOString(),
    };
  });

  // Upsert in batches
  const UPSERT_BATCH_SIZE = 50;
  let totalUpserted = 0;

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('apishopee_order_escrow')
      .upsert(batch, { onConflict: 'shop_id,order_sn' });

    if (error) {
      console.error('[FINANCE-SYNC] Escrow upsert error:', error);
    } else {
      totalUpserted += batch.length;
    }
  }

  return totalUpserted;
}

async function markOrdersEscrowFetched(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  orderSns: string[]
): Promise<void> {
  if (orderSns.length === 0) return;

  const { error } = await supabase
    .from('apishopee_orders')
    .update({ is_escrow_fetched: true })
    .eq('shop_id', shopId)
    .in('order_sn', orderSns);

  if (error) {
    console.error('[FINANCE-SYNC] Failed to mark orders as fetched:', error);
  }
}

// ==================== MAIN SYNC FUNCTION ====================

async function syncFinanceForShop(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  forceAll: boolean = false
): Promise<{ success: boolean; fetched: number; failed: number; total: number; error?: string }> {
  console.log(`[FINANCE-SYNC] Starting Finance Sync for shop ${shopId} (forceAll: ${forceAll})`);

  // Get shop credentials and token
  const shopData = await getShopCredentialsAndToken(supabase, shopId);
  if (!shopData) {
    return { success: false, fetched: 0, failed: 0, total: 0, error: 'Failed to get shop credentials/token' };
  }

  const { credentials, token } = shopData;

  try {
    // Query orders that need escrow fetching
    let query = supabase
      .from('apishopee_orders')
      .select('order_sn, shop_id, order_status, total_amount, create_time')
      .eq('shop_id', shopId)
      .eq('order_status', 'COMPLETED');

    if (!forceAll) {
      // Include orders where is_escrow_fetched = false OR is_escrow_fetched IS NULL
      query = query.or('is_escrow_fetched.eq.false,is_escrow_fetched.is.null');
    }

    const { data: orders, error: queryError } = await query
      .order('create_time', { ascending: false })
      .limit(500); // Process max 500 orders per run

    if (queryError) {
      console.error('[FINANCE-SYNC] Query error:', queryError);
      return { success: false, fetched: 0, failed: 0, total: 0, error: queryError.message };
    }

    if (!orders || orders.length === 0) {
      console.log('[FINANCE-SYNC] No orders to process');
      return { success: true, fetched: 0, failed: 0, total: 0 };
    }

    console.log(`[FINANCE-SYNC] Found ${orders.length} orders to fetch escrow`);

    let fetched = 0;
    let failed = 0;
    const fetchedOrderSns: string[] = [];
    const escrowDataList: EscrowData[] = [];

    // Process orders in batches
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      console.log(`[FINANCE-SYNC] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(orders.length / BATCH_SIZE)}`);

      for (const order of batch) {
        const escrowData = await fetchEscrowDetail(supabase, credentials, shopId, token, order.order_sn);

        if (escrowData) {
          escrowDataList.push(escrowData);
          fetchedOrderSns.push(order.order_sn);
          fetched++;
        } else {
          failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }

      // Upsert escrow data after each batch
      if (escrowDataList.length > 0) {
        await upsertEscrowData(supabase, shopId, escrowDataList);
        escrowDataList.length = 0; // Clear the array
      }

      // Mark orders as fetched after each batch
      if (fetchedOrderSns.length > 0) {
        await markOrdersEscrowFetched(supabase, shopId, fetchedOrderSns);
        fetchedOrderSns.length = 0; // Clear the array
      }
    }

    console.log(`[FINANCE-SYNC] Completed. Fetched: ${fetched}, Failed: ${failed}`);

    return {
      success: true,
      fetched,
      failed,
      total: orders.length,
    };

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[FINANCE-SYNC] Error:', errorMessage);
    return { success: false, fetched: 0, failed: 0, total: 0, error: errorMessage };
  }
}

// ==================== STATS FUNCTION ====================

async function getFinanceStats(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<{
  total_completed: number;
  escrow_fetched: number;
  escrow_pending: number;
  total_escrow_amount: number;
  total_gmv: number;
}> {
  // Count completed orders
  const { count: totalCompleted } = await supabase
    .from('apishopee_orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('order_status', 'COMPLETED');

  // Count escrow fetched
  const { count: escrowFetched } = await supabase
    .from('apishopee_orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('order_status', 'COMPLETED')
    .eq('is_escrow_fetched', true);

  // Count escrow pending
  const { count: escrowPending } = await supabase
    .from('apishopee_orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('order_status', 'COMPLETED')
    .eq('is_escrow_fetched', false);

  // Sum escrow amount
  const { data: escrowSum } = await supabase
    .from('apishopee_order_escrow')
    .select('escrow_amount')
    .eq('shop_id', shopId);

  const totalEscrowAmount = escrowSum?.reduce((sum, row) => sum + (row.escrow_amount || 0), 0) || 0;

  // Sum GMV (total_amount from completed orders)
  const { data: gmvSum } = await supabase
    .from('apishopee_orders')
    .select('total_amount')
    .eq('shop_id', shopId)
    .eq('order_status', 'COMPLETED');

  const totalGmv = gmvSum?.reduce((sum, row) => sum + (row.total_amount || 0), 0) || 0;

  return {
    total_completed: totalCompleted || 0,
    escrow_fetched: escrowFetched || 0,
    escrow_pending: escrowPending || 0,
    total_escrow_amount: totalEscrowAmount,
    total_gmv: totalGmv,
  };
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action = 'sync', shop_id } = body;

    if (!shop_id) {
      return new Response(JSON.stringify({ error: 'shop_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let result;

    switch (action) {
      case 'sync':
        // Normal sync - only fetch for orders with is_escrow_fetched = false
        result = await syncFinanceForShop(supabase, shop_id, false);
        break;

      case 'sync-all':
        // Force re-sync all COMPLETED orders
        result = await syncFinanceForShop(supabase, shop_id, true);
        break;

      case 'stats':
        // Get finance statistics
        result = await getFinanceStats(supabase, shop_id);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      shop_id,
      ...result,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[FINANCE-SYNC] Error:', error);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      success: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
