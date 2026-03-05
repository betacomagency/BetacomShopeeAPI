/**
 * Shopee SDK Types
 * Định nghĩa types cho Shopee SDK
 */

export interface AccessToken {
  refresh_token: string;
  access_token: string;
  expire_in: number;
  request_id?: string;
  error?: string;
  message?: string;
  shop_id?: number;
  merchant_id?: number;
  merchant_id_list?: number[];
  shop_id_list?: number[];
  supplier_id_list?: number[];
  user_id_list?: number[];
  expired_at?: number;
}

export interface RefreshedAccessToken extends Omit<AccessToken, 'merchant_id_list' | 'shop_id_list' | 'supplier_id_list' | 'user_id_list'> {
  partner_id: number;
  shop_id?: number;
  merchant_id?: number;
  supplier_id?: number;
  user_id?: number;
}


// ==================== SHOP API TYPES ====================

// SIP Affiliate Shop Info
export interface SipAffiShop {
  affi_shop_id: number;
  region: string;
}

// Linked Direct Shop Info
export interface LinkedDirectShop {
  direct_shop_id: number;
  direct_shop_region: string;
}

// Outlet Shop Info
export interface OutletShopInfo {
  outlet_shop_id: number;
}

// GET /api/v2/shop/get_shop_info Response
export interface ShopInfo {
  shop_name: string;
  region: string;
  status: 'BANNED' | 'FROZEN' | 'NORMAL';
  sip_affi_shops?: SipAffiShop[];
  is_cb: boolean;
  request_id: string;
  auth_time: number;
  expire_time: number;
  is_sip: boolean;
  is_upgraded_cbsc: boolean;
  merchant_id: number | null;
  shop_fulfillment_flag: string;
  is_main_shop: boolean;
  is_direct_shop: boolean;
  linked_main_shop_id: number;
  linked_direct_shop_list?: LinkedDirectShop[];
  is_one_awb?: boolean;
  is_mart_shop?: boolean;
  is_outlet_shop?: boolean;
  mart_shop_id?: number;
  outlet_shop_info_list?: OutletShopInfo[];
}

export interface GetShopInfoResponse {
  error: string;
  message: string;
  request_id: string;
  auth_time?: number;
  expire_time?: number;
  shop_name?: string;
  region?: string;
  status?: 'BANNED' | 'FROZEN' | 'NORMAL';
  shop_fulfillment_flag?: string;
  is_cb?: boolean;
  is_upgraded_cbsc?: boolean;
  merchant_id?: number | null;
  is_sip?: boolean;
  sip_affi_shops?: SipAffiShop[];
  is_main_shop?: boolean;
  is_direct_shop?: boolean;
  linked_direct_shop_list?: LinkedDirectShop[];
  linked_main_shop_id?: number;
  is_one_awb?: boolean;
  is_mart_shop?: boolean;
  is_outlet_shop?: boolean;
  mart_shop_id?: number;
  outlet_shop_info_list?: OutletShopInfo[];
}

// GET /api/v2/shop/get_profile Response
export interface ShopProfile {
  shop_logo: string;
  description: string;
  shop_name: string;
  invoice_issuer?: string;
}

export interface GetShopProfileResponse {
  error: string;
  message: string;
  request_id: string;
  response?: ShopProfile;
}

// GET /api/v2/public/get_shops_by_partner Response
export interface AuthedShop {
  shop_id: number;
  region: string;
  auth_time: number;
  expire_time: number;
  sip_affi_shops?: SipAffiShop[];
}

export interface GetShopsByPartnerResponse {
  authed_shop_list: AuthedShop[];
  sip_affi_shop_list?: SipAffiShop[];
  request_id: string;
  more: boolean;
  error?: string;
  message?: string;
}

// GET /api/v2/public/get_merchants_by_partner Response
export interface AuthedMerchant {
  merchant_id: number;
  region: string;
  auth_time: number;
  expire_time: number;
}

export interface GetMerchantsByPartnerResponse {
  authed_merchant_list: AuthedMerchant[];
  request_id: string;
  more: boolean;
  error?: string;
  message?: string;
}

// ==================== SHOP PERFORMANCE TYPES ====================
// GET /api/v2/account_health/get_shop_performance

export interface ShopPerformanceOverall {
  rating: 1 | 2 | 3 | 4; // Poor=1, Improvement Needed=2, Good=3, Excellent=4
  fulfillment_failed: number;
  listing_failed: number;
  custom_service_failed: number;
}

export interface ShopPerformanceMetricTarget {
  value: number;
  comparator: '<' | '<=' | '>' | '>=' | '=';
}

export interface ShopPerformanceMetric {
  metric_type: 1 | 2 | 3; // 1=Fulfillment, 2=Listing, 3=CustomerService
  metric_id: number;
  parent_metric_id: number;
  metric_name: string;
  current_period: number;
  last_period: number;
  unit: 1 | 2 | 3 | 4 | 5; // 1=Number, 2=Percentage, 3=Second, 4=Day, 5=Hour
  target: ShopPerformanceMetricTarget;
  exemption_end_date?: string;
}

export interface GetShopPerformanceResponse {
  error: string;
  message: string;
  request_id: string;
  response?: {
    overall_performance: ShopPerformanceOverall;
    metric_list: ShopPerformanceMetric[];
  };
}

// ==================== METRIC SOURCE DETAIL TYPES ====================
// GET /api/v2/account_health/get_metric_source_detail

export interface NfrOrder {
  order_sn: string;
  non_fulfillment_type: number; // 1=System Cancel, 2=Seller Cancel, 3=Return Refund
  detailed_reason: number;
}

export interface CancellationOrder {
  order_sn: string;
  cancellation_type: number; // 1=System Cancel, 2=Seller Cancel
  detailed_reason: number;
}

export interface ReturnRefundOrder {
  order_sn: string;
  detailed_reason: number;
}

export interface LsrOrder {
  order_sn: string;
  shipping_deadline: number;
  actual_shipping_time: number;
  late_by_days: number;
  actual_pick_up_time: number;
  shipping_channel: string;
  first_mile_type: string; // Pickup | Drop off
  diagnosis_scenario: string[];
}

export interface FhrOrder {
  order_sn: string;
  parcel_id: number;
  parcel_display_id: string;
  confirm_time: number;
  handover_deadline: number;
  fast_handover_due_date: number;
  arrange_pick_up_time: number;
  handover_time: number;
  shipping_channel: string;
  first_mile_type: string; // Pickup | Drop off
  first_mile_tracking_no: string;
  diagnosis_scenario: string[];
}

export interface OpfrDayDetail {
  date: string; // e.g. "19/10/2024"
  scheduled_pickup_num: number;
  failed_pickup_num: number;
  opfr: number;
  target: string; // e.g. "49.90%"
}

export interface ViolationListing {
  item_id: number;
  detailed_reason: number; // 1=Prohibited,2=Counterfeit,3=Spam,4=InappropriateImage,5=Insufficient,6=MallImprovement,7=OtherImprovement,8=PQR
  update_time: number;
}

export interface PreOrderListingViolation {
  date: string; // e.g. "03/11/2024"
  live_listing_count: number;
  pre_order_listing_count: number;
  pre_order_listing_rate: number;
  target: string; // e.g. "13.00%"
}

export interface PreOrderListing {
  item_id: number;
  current_pre_order_status: number; // 1=Yes, 2=No
}

export interface SddListing {
  item_id: number;
  current_sdd_status: number; // 1=Yes, 0=No
}

export interface NddListing {
  item_id: number;
  current_ndd_status: number; // 1=Yes, 0=No
}

export interface AptOrder {
  order_sn: string;
  order_create_time: number;
  arrange_pick_up_time: number;
  actual_pick_up_time: number;
  preparation_days: number;
  shipping_channel: string;
  first_mile_type: string; // Pickup | Drop off
  first_mile_tracking_no: string;
}

export interface HdListing {
  item_id: number;
  current_status: number; // 1=Yes, 2=No
}

export interface SaturdayShipment {
  order_sn: string;
  order_create_time: number;
  arrange_pick_up_time: number;
  actual_pick_up_time: number;
  preparation_days: number;
  shipping_channel: string;
  first_mile_type: string; // Pickup | Drop off
  first_mile_tracking_no: string;
}

export interface GetMetricSourceDetailResponse {
  error: string;
  message: string;
  request_id: string;
  response?: {
    metric_id: number;
    nfr_order_list?: NfrOrder[];
    cancellation_order_list?: CancellationOrder[];
    return_refund_order_list?: ReturnRefundOrder[];
    lsr_order_list?: LsrOrder[];
    fhr_order_list?: FhrOrder[];
    opfr_day_detail_data_list?: OpfrDayDetail[];
    violation_listing_list?: ViolationListing[];
    pre_order_listing_violation_data_list?: PreOrderListingViolation[];
    pre_order_listing_list?: PreOrderListing[];
    sdd_listing_list?: SddListing[];
    ndd_listing_list?: NddListing[];
    apt_order_list?: AptOrder[];
    hd_listing_list?: HdListing;
    saturday_shipment_list?: SaturdayShipment[];
    total_count?: number;
  };
}

// DB row types (from Supabase)
export interface ShopPerformanceRow {
  id: string;
  shop_id: number;
  synced_at: string;
  request_id: string | null;
  overall_rating: number | null;
  fulfillment_failed: number | null;
  listing_failed: number | null;
  custom_service_failed: number | null;
  raw_response: GetShopPerformanceResponse;
}

export interface ShopPerformanceMetricRow {
  id: string;
  shop_id: number;
  synced_at: string;
  metric_type: number | null;
  metric_id: number | null;
  parent_metric_id: number | null;
  metric_name: string | null;
  current_period: number | null;
  last_period: number | null;
  unit: number | null;
  target_value: number | null;
  target_comparator: string | null;
  exemption_end_date: string | null;
}

export interface ShopPerformanceDetailRow {
  id: string;
  performance_id: string;
  shop_id: number;
  metric_id: number;
  fetched_at: string;
  total_count: number | null;
  page_no: number | null;
  page_size: number | null;
  nfr_order_list: NfrOrder[] | null;
  cancellation_order_list: CancellationOrder[] | null;
  return_refund_order_list: ReturnRefundOrder[] | null;
  lsr_order_list: LsrOrder[] | null;
  fhr_order_list: FhrOrder[] | null;
  opfr_day_detail_data_list: OpfrDayDetail[] | null;
  violation_listing_list: ViolationListing[] | null;
  pre_order_listing_violation_data_list: PreOrderListingViolation[] | null;
  pre_order_listing_list: PreOrderListing[] | null;
  sdd_listing_list: SddListing[] | null;
  ndd_listing_list: NddListing[] | null;
  apt_order_list: AptOrder[] | null;
  hd_listing_list: HdListing | null;
  saturday_shipment_list: SaturdayShipment[] | null;
  raw_response: GetMetricSourceDetailResponse;
}
