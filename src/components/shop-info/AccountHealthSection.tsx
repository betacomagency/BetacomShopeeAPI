/**
 * Account Health Section - Hiệu quả hoạt động shop
 * Hiển thị: Điểm phạt tổng hợp, Chỉ số hiệu suất, Lịch sử điểm phạt,
 *           Lịch sử xử phạt, Sản phẩm có vấn đề, Đơn hàng trễ
 */

import { useAccountHealth } from '@/hooks/useAccountHealth';
import type {
  Punishment, OngoingPunishment, PerformanceMetric, PenaltyPointRecord, ListingIssue, LateOrder,
} from '@/hooks/useAccountHealth';
import {
  AlertTriangle, ShieldCheck, ShieldAlert, Package, Clock,
  RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Star, MessageCircle, Truck, ListChecks,
  Minus,
} from 'lucide-react';
import { useState } from 'react';

interface AccountHealthSectionProps {
  shopId: number;
}

// ==================== CONSTANTS ====================

const PERFORMANCE_RATING: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Kém', color: 'text-red-600', bg: 'bg-red-100' },
  2: { label: 'Cần cải thiện', color: 'text-amber-600', bg: 'bg-amber-100' },
  3: { label: 'Tốt', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  4: { label: 'Xuất sắc', color: 'text-blue-600', bg: 'bg-blue-100' },
};

const METRIC_TYPE_LABELS: Record<number, { label: string; icon: typeof Truck }> = {
  1: { label: 'Quản Lý Đơn Hàng', icon: Truck },
  2: { label: 'Vi phạm đăng bán', icon: Package },
  3: { label: 'Chăm sóc khách hàng', icon: MessageCircle },
};

// Tên tiếng Việt cho tất cả metric_id (khớp Shopee Seller Center)
const METRIC_NAMES_VI: Record<number, string> = {
  // === Quản Lý Đơn Hàng (Fulfillment - type 1) ===
  1: 'Tỷ lệ giao hàng trễ',
  3: 'Tỷ lệ đơn hàng không thành công',
  4: 'Thời gian chuẩn bị hàng',
  25: 'Tỷ lệ giao hàng nhanh',
  28: 'Vi phạm tỷ lệ lấy hàng trễ',
  42: 'Tỷ lệ hủy đơn',
  43: 'Tỷ lệ Trả hàng/Hoàn tiền',
  // NDD variants
  85: 'Tỷ lệ giao hàng trễ (NDD)',
  88: 'Tỷ lệ đơn hàng không thành công (NDD)',
  91: 'Tỷ lệ hủy đơn (NDD)',
  92: 'Tỷ lệ Trả hàng/Hoàn tiền (NDD)',
  // Fast Handover sub-types
  2001: 'Tỷ lệ giao hàng nhanh (SLS)',
  2002: 'Tỷ lệ giao hàng nhanh (FBS)',
  2003: 'Tỷ lệ giao hàng nhanh (3PF)',

  // === Vi phạm đăng bán (Listing - type 2) ===
  12: 'Hàng đặt trước',
  15: 'Số ngày tỷ lệ hàng đặt trước vượt quá chỉ tiêu',
  52: 'Sản phẩm bị khóa/xóa',
  53: 'Các vi phạm khác',
  96: 'Tỷ lệ sản phẩm SDD',
  97: 'Tỷ lệ sản phẩm NDD',

  // === Chăm sóc khách hàng (Customer Service - type 3) ===
  // IDs dưới đây sẽ được map nếu API trả về, fallback dùng tên từ API
  5: 'Tỉ lệ phản hồi',
  6: 'Thời gian phản hồi',
  7: 'Đánh giá Shop',
  8: 'Tin nhắn chưa trả lời',
  // Alternate possible IDs from Shopee
  30: 'Tỉ lệ phản hồi',
  31: 'Thời gian phản hồi',
  32: 'Đánh giá Shop',
  33: 'Tin nhắn chưa trả lời',
  60: 'Tỉ lệ phản hồi',
  61: 'Thời gian phản hồi',
  62: 'Đánh giá Shop',
  63: 'Tin nhắn chưa trả lời',
};

// Tên tiếng Việt cho violation_type trong lịch sử điểm phạt
const VIOLATION_TYPE_VI: Record<number, string> = {
  5: 'Tỷ lệ giao hàng trễ cao',
  6: 'Tỷ lệ đơn không thành công cao',
  7: 'Số lượng đơn không thành công cao',
  8: 'Số lượng đơn giao trễ cao',
  9: 'Sản phẩm cấm',
  10: 'Hàng giả/vi phạm SHTT',
  11: 'Spam',
  12: 'Sao chép/ăn cắp hình ảnh',
  13: 'Đăng lại sản phẩm đã xóa',
  14: 'Mua hàng giả từ Mall',
  15: 'Hàng giả bị Shopee phát hiện',
  16: 'Tỷ lệ hàng đặt trước cao',
  17: 'Gian lận',
  18: 'Gian lận voucher',
  19: 'Địa chỉ trả hàng giả',
  20: 'Lạm dụng vận chuyển',
  21: 'Tin nhắn chưa trả lời nhiều',
  22: 'Trả lời chat thô lỗ',
  23: 'Yêu cầu người mua hủy đơn',
  24: 'Trả lời đánh giá thô lỗ',
  25: 'Vi phạm chính sách trả hàng/hoàn tiền',
  101: 'Vi phạm theo Tier',
  3026: 'Lạm dụng SHTT Shopee',
  3028: 'Vi phạm quy định tên shop',
  3030: 'Giao dịch ngoài nền tảng',
  3032: 'Giao kiện hàng rỗng/thiếu',
  3034: 'Vi phạm nghiêm trọng trên Shopee Feed',
  3036: 'Vi phạm nghiêm trọng trên Shopee LIVE',
  3038: 'Lạm dụng tag Local Vendor',
  3040: 'Tag shop gây hiểu nhầm trên ảnh SP',
  3042: 'Hàng giả/vi phạm SHTT (kiểm tra)',
  3044: 'Tái phạm vi phạm SHTT',
  3046: 'Vi phạm bán động vật sống',
  3048: 'Spam chat',
  3050: 'Tỷ lệ trả hàng quốc tế cao',
  3052: 'Vi phạm quyền riêng tư người mua',
  3054: 'Đặt đơn ảo',
  3056: 'Hình ảnh phản cảm',
  3058: 'Sai danh mục sản phẩm',
  3060: 'Tỷ lệ đơn không thành công cực cao',
  3062: 'Quảng cáo AMS chưa thanh toán',
  3064: 'SP liên quan đến chính phủ',
  3066: 'Đăng bán quà tặng không hợp lệ',
  3068: 'Tỷ lệ đơn không thành công cao (NDD)',
  3070: 'Tỷ lệ giao hàng trễ cao (NDD)',
  3072: 'Vi phạm tỷ lệ lấy hàng trễ',
  3074: 'Giao dịch ngoài nền tảng qua chat',
  3090: 'SP cấm (Cực nghiêm trọng)',
  3091: 'SP cấm (Nghiêm trọng)',
  3092: 'SP cấm (Trung bình)',
  3093: 'SP cấm (Nhẹ)',
  3094: 'Hàng giả (Cực nghiêm trọng)',
  3095: 'Hàng giả (Nghiêm trọng)',
  3096: 'Hàng giả (Trung bình)',
  3097: 'Hàng giả (Nhẹ)',
  3098: 'Spam (Cực nghiêm trọng)',
  3099: 'Spam (Nghiêm trọng)',
  3100: 'Spam (Trung bình)',
  3101: 'Spam (Nhẹ)',
  3145: 'Tỷ lệ trả hàng/hoàn tiền (Non-Integrated)',
  4130: 'Chất lượng sản phẩm kém',
};

// Tên tiếng Việt cho sub-listing violations (children of metric 52)
// API có thể trả về cả dạng Title Case và snake_case
const LISTING_VIOLATION_CHILDREN_VI: Record<string, string> = {
  // Title Case (format cũ)
  'Prohibited': 'Các sản phẩm cấm',
  'Counterfeit': 'Đăng bán hàng giả/nhái',
  'Counterfeit/IP infringement': 'Đăng bán hàng giả/nhái',
  'Spam': 'Sản phẩm trùng lặp',
  'PQR Products': 'Sản phẩm có đánh giá chất lượng tiêu cực',
  'Inappropriate Image': 'Hình ảnh không phù hợp',
  'Insufficient Info': 'Thiếu thông tin',
  // snake_case (format mới từ API)
  'prohibited_listings': 'Các sản phẩm cấm',
  'counterfeit_ip_infringement': 'Đăng bán hàng giả/nhái',
  'spam_listings': 'Sản phẩm trùng lặp',
  'pqr_products': 'Sản phẩm có đánh giá chất lượng tiêu cực',
  'inappropriate_image': 'Hình ảnh không phù hợp',
  'insufficient_info': 'Thiếu thông tin',
  'other_listings': 'Vi phạm khác',
};

// Tên tiếng Việt cho metric_name dạng snake_case (fallback khi metric_id chưa map)
const METRIC_NAME_SNAKE_VI: Record<string, string> = {
  // Chăm sóc khách hàng
  'response_rate': 'Tỉ lệ phản hồi',
  'response_time': 'Thời gian phản hồi',
  'shop_rating': 'Đánh giá Shop',
  'unread_messages': 'Tin nhắn chưa trả lời',
  // Quản Lý Đơn Hàng
  'non_fulfillment_rate': 'Tỷ lệ đơn hàng không thành công',
  'late_shipment_rate': 'Tỷ lệ giao hàng trễ',
  'preparation_time': 'Thời gian chuẩn bị hàng',
  'cancellation_rate': 'Tỷ lệ hủy đơn',
  'return_refund_rate': 'Tỷ lệ Trả hàng/Hoàn tiền',
  'fast_handover_rate': 'Tỷ lệ giao hàng nhanh',
  'late_pickup_rate': 'Vi phạm tỷ lệ lấy hàng trễ',
  // Vi phạm đăng bán
  'pre_order_listing_rate': 'Hàng đặt trước',
  'pre_order_exceed_days': 'Số ngày tỷ lệ hàng đặt trước vượt quá chỉ tiêu',
  'locked_deleted_listings': 'Sản phẩm bị khóa/xóa',
  'other_violations': 'Các vi phạm khác',
  'sdd_product_rate': 'Tỷ lệ sản phẩm SDD',
  'ndd_product_rate': 'Tỷ lệ sản phẩm NDD',
};

const PUNISHMENT_TYPES: Record<number, string> = {
  103: 'Không hiển thị trong danh mục',
  104: 'Không hiển thị trong tìm kiếm',
  105: 'Không thể tạo sản phẩm mới',
  106: 'Không thể chỉnh sửa sản phẩm',
  107: 'Không tham gia khuyến mãi',
  108: 'Không trợ giá vận chuyển',
  109: 'Tạm khóa tài khoản',
  600: 'Ẩn khỏi tìm kiếm',
  601: 'Ẩn khỏi đề xuất',
  602: 'Ẩn khỏi danh mục',
  1109: 'Giới hạn đăng bán (Tier 1)',
  1110: 'Giới hạn đăng bán (Tier 2)',
  1111: 'Giới hạn đăng bán (POL)',
  1112: 'Giới hạn đăng bán',
  2008: 'Giới hạn đơn hàng',
};

const PUNISHMENT_REASONS: Record<number, string> = {
  1: 'Tier 1',
  2: 'Tier 2',
  3: 'Tier 3',
  4: 'Tier 4',
  5: 'Tier 5',
  1109: 'Giới hạn Tier 1',
  1110: 'Giới hạn Tier 2',
  1111: 'Giới hạn POL',
};

const LISTING_ISSUE_REASONS: Record<number, string> = {
  1: 'Hàng cấm',
  2: 'Hàng giả/vi phạm SHTT',
  3: 'Spam',
  4: 'Hình ảnh không phù hợp',
  5: 'Thiếu thông tin',
  6: 'Cần cải thiện (Mall)',
  7: 'Cần cải thiện (khác)',
};

// ==================== HELPERS ====================

/**
 * Lấy tên tiếng Việt cho metric, fallback sang tên gốc từ API
 */
function getMetricNameVI(metric: PerformanceMetric): string {
  // 1. Thử map theo metric_id
  if (METRIC_NAMES_VI[metric.metric_id]) {
    return METRIC_NAMES_VI[metric.metric_id];
  }
  // 2. Thử map theo tên (listing violation children)
  if (LISTING_VIOLATION_CHILDREN_VI[metric.metric_name]) {
    return LISTING_VIOLATION_CHILDREN_VI[metric.metric_name];
  }
  // 3. Thử map theo tên snake_case
  if (METRIC_NAME_SNAKE_VI[metric.metric_name]) {
    return METRIC_NAME_SNAKE_VI[metric.metric_name];
  }
  // 4. Fallback: dùng tên gốc từ API
  return metric.metric_name;
}

function formatDate(ts: number): string {
  if (!ts) return '---';
  return new Date(ts * 1000).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function formatMetricValue(value: number | null, unit: number): string {
  if (value === null || value === undefined) return '---';
  // Shopee API trả về % đã nhân 100 sẵn (vd: 93.78 = 93.78%)
  if (unit === 2) return `${value.toFixed(2)}%`;
  if (unit === 3) return `${value.toFixed(0)}s`;
  if (unit === 4) return `${value.toFixed(1)} ngày`;
  if (unit === 5) return `${value.toFixed(1)} giờ`;
  return value.toFixed(0);
}

function formatTargetValue(target: { value: number; comparator: string }, unit: number): string {
  const val = unit === 2 ? `${target.value.toFixed(2)}%` : target.value.toString();
  return `${target.comparator} ${val}`;
}

function meetsTarget(value: number | null, target: { value: number; comparator: string }): boolean | null {
  if (value === null || value === undefined) return null;
  switch (target.comparator) {
    case '<': return value < target.value;
    case '<=': return value <= target.value;
    case '>': return value > target.value;
    case '>=': return value >= target.value;
    case '=': return value === target.value;
    default: return null;
  }
}

// ==================== SUB-COMPONENTS ====================

function PunishmentCard({ item }: { item: Punishment }) {
  const isExpired = item.end_time * 1000 < Date.now();

  return (
    <div className={`p-3 rounded-lg border ${isExpired ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isExpired ? 'text-slate-600' : 'text-amber-800'}`}>
            {PUNISHMENT_TYPES[item.punishment_type] || `Loại #${item.punishment_type}`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {PUNISHMENT_REASONS[item.reason] || `Lý do #${item.reason}`}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
          isExpired ? 'bg-slate-200 text-slate-600' : 'bg-amber-200 text-amber-800'
        }`}>
          {isExpired ? 'Đã hết hạn' : 'Đang áp dụng'}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
        <span>{formatDate(item.start_time)} → {formatDate(item.end_time)}</span>
        {item.listing_limit != null && item.listing_limit > 0 && (
          <span className="text-amber-600">Giới hạn: {item.listing_limit} SP</span>
        )}
        {item.order_limit != null && item.order_limit !== '' && (
          <span className="text-amber-600">Giới hạn đơn: {item.order_limit}</span>
        )}
      </div>
    </div>
  );
}

function OngoingPunishmentBadge({ item }: { item: OngoingPunishment }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50">
      <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-700">{item.punishment_name}</p>
        <p className="text-xs text-red-500">
          Tier {item.punishment_tier} - Còn {item.days_left} ngày
        </p>
      </div>
    </div>
  );
}

function MetricRow({ metric }: { metric: PerformanceMetric }) {
  const isChild = metric.parent_metric_id !== 0;
  const status = meetsTarget(metric.current_period, metric.target);
  const trend = metric.current_period !== null && metric.last_period !== null
    ? metric.current_period - metric.last_period
    : null;

  return (
    <div className={`flex items-center gap-3 py-2.5 ${isChild ? 'pl-6 border-l-2 border-slate-100' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isChild ? 'text-slate-600' : 'font-medium text-slate-800'}`}>
          {getMetricNameVI(metric)}
        </p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        {/* Current value */}
        <div className="w-20">
          <p className={`text-sm font-medium ${
            status === true ? 'text-emerald-600' : status === false ? 'text-red-600' : 'text-slate-600'
          }`}>
            {formatMetricValue(metric.current_period, metric.unit)}
          </p>
        </div>
        {/* Trend */}
        <div className="w-5">
          {trend !== null && trend !== 0 ? (
            trend > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
            )
          ) : (
            <Minus className="w-3.5 h-3.5 text-slate-300" />
          )}
        </div>
        {/* Target */}
        <div className="w-20">
          <p className="text-xs text-slate-400">
            {formatTargetValue(metric.target, metric.unit)}
          </p>
        </div>
        {/* Status badge */}
        <div className="w-6">
          {status === true ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : status === false ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function AccountHealthSection({ shopId }: AccountHealthSectionProps) {
  const { data, isLoading, isError, error, refetch, isFetching, cachedAt, hasCachedData } = useAccountHealth(shopId);
  const [showAllPunishments, setShowAllPunishments] = useState(false);
  const [showPenaltyHistory, setShowPenaltyHistory] = useState(false);
  const [expandedMetricTypes, setExpandedMetricTypes] = useState<Set<number>>(new Set([1, 2, 3]));

  // Extract data (safe với null/undefined)
  const penalty = data?.shopPenalty?.response;
  const performance = data?.shopPerformance?.response;
  const penaltyHistory = data?.penaltyPointHistory?.response;
  const ongoingCount = data?.punishmentOngoing?.response?.total_count ?? 0;
  const completedCount = data?.punishmentCompleted?.response?.total_count ?? 0;
  const listingsCount = data?.listingsIssues?.response?.total_count ?? 0;
  const lateOrdersCount = data?.lateOrders?.response?.total_count ?? 0;
  const overallPoints = penalty?.penalty_points?.overall_penalty_points ?? 0;
  const rating = performance?.overall_performance?.rating ?? 0;

  const hasAnyIssue = overallPoints > 0 || ongoingCount > 0 || listingsCount > 0 || lateOrdersCount > 0;
  const hasData = !!data;

  // Combine ongoing + completed punishments
  const allPunishments = [
    ...(data?.punishmentOngoing?.response?.punishment_list || []),
    ...(data?.punishmentCompleted?.response?.punishment_list || []),
  ].sort((a, b) => b.issue_time - a.issue_time);
  const displayPunishments = showAllPunishments ? allPunishments : allPunishments.slice(0, 3);

  // Group metrics by type
  const metricsByType = (performance?.metric_list || []).reduce((acc, metric) => {
    if (!acc[metric.metric_type]) acc[metric.metric_type] = [];
    acc[metric.metric_type].push(metric);
    return acc;
  }, {} as Record<number, PerformanceMetric[]>);

  const toggleMetricType = (type: number) => {
    setExpandedMetricTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!hasData ? (
            <ShieldCheck className="w-5 h-5 text-slate-400" />
          ) : hasAnyIssue ? (
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          )}
          <h3 className="font-semibold text-slate-800">Hiệu quả hoạt động</h3>
          {hasData && (
            hasAnyIssue ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                Cần chú ý
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                Tốt
              </span>
            )
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Đang đồng bộ...' : 'Đồng bộ'}
        </button>
      </div>

      {/* Syncing / Loading / Error indicators */}
      {isFetching && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" />
          <span className="text-xs text-orange-600">Đang đồng bộ dữ liệu từ Shopee...</span>
        </div>
      )}
      {isLoading && !isFetching && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          <span className="text-xs text-slate-500">Đang tải dữ liệu đã lưu...</span>
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-red-600 flex-1">Lỗi: {error?.message || 'Không thể đồng bộ'}</span>
          <button
            onClick={() => refetch()}
            className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Overall Penalty Points */}
        <div className={`rounded-xl border p-4 ${hasData && overallPoints > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${hasData && overallPoints > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">Sao Quả Tạ</span>
          </div>
          <p className={`text-2xl font-bold ${!hasData ? 'text-slate-300' : overallPoints > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {hasData ? overallPoints : '---'}
          </p>
        </div>

        {/* Performance Rating */}
        <div className={`rounded-xl border p-4 ${
          !hasData ? 'border-slate-200 bg-white' :
          rating >= 3 ? 'border-emerald-200 bg-emerald-50' :
          rating === 2 ? 'border-amber-200 bg-amber-50' :
          rating === 1 ? 'border-red-200 bg-red-50' :
          'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Star className={`w-4 h-4 ${
              !hasData ? 'text-slate-400' :
              rating >= 3 ? 'text-emerald-500' : rating === 2 ? 'text-amber-500' : rating === 1 ? 'text-red-500' : 'text-slate-400'
            }`} />
            <span className="text-xs text-slate-500">Hiệu suất</span>
          </div>
          <p className={`text-lg font-bold ${!hasData ? 'text-slate-300' : PERFORMANCE_RATING[rating]?.color || 'text-slate-800'}`}>
            {PERFORMANCE_RATING[rating]?.label || '---'}
          </p>
        </div>

        {/* Ongoing Punishments */}
        <div className={`rounded-xl border p-4 ${hasData && ongoingCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className={`w-4 h-4 ${hasData && ongoingCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">Đang xử phạt</span>
          </div>
          <p className={`text-2xl font-bold ${!hasData ? 'text-slate-300' : ongoingCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {hasData ? ongoingCount : '---'}
          </p>
        </div>

        {/* Listings Issues */}
        <div className={`rounded-xl border p-4 ${hasData && listingsCount > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Package className={`w-4 h-4 ${hasData && listingsCount > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">SP có vấn đề</span>
          </div>
          <p className={`text-2xl font-bold ${!hasData ? 'text-slate-300' : listingsCount > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
            {hasData ? listingsCount : '---'}
          </p>
        </div>

        {/* Late Orders */}
        <div className={`rounded-xl border p-4 ${hasData && lateOrdersCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${hasData && lateOrdersCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">Đơn trễ hạn</span>
          </div>
          <p className={`text-2xl font-bold ${!hasData ? 'text-slate-300' : lateOrdersCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {hasData ? lateOrdersCount : '---'}
          </p>
        </div>
      </div>

      {/* All good message */}
      {hasData && !hasAnyIssue && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Shop đang hoạt động tốt!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Không có điểm phạt, xử phạt, sản phẩm vi phạm hay đơn trễ hạn.
              {completedCount > 0 && ` (${completedCount} xử phạt đã hoàn thành trước đó)`}
            </p>
          </div>
        </div>
      )}

      {/* Penalty Points Breakdown */}
      {penalty?.penalty_points && overallPoints > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              Điểm Sao Quả Tạ trong Quý ({overallPoints} điểm)
            </h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Đơn hàng không thành công', value: penalty.penalty_points.non_fulfillment_rate },
              { label: 'Giao hàng trễ', value: penalty.penalty_points.late_shipment_rate },
              { label: 'Vi phạm đăng bán', value: penalty.penalty_points.listing_violations },
              { label: 'Lấy hàng trễ (OPFR)', value: penalty.penalty_points.opfr_violations },
              { label: 'Vi phạm khác', value: penalty.penalty_points.others },
            ].map(item => (
              <div key={item.label} className={`text-center p-3 rounded-lg ${item.value > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${item.value > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Ongoing punishments from shopPenalty */}
          {penalty.ongoing_punishment && penalty.ongoing_punishment.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hình phạt đang áp dụng</p>
              {penalty.ongoing_punishment.map((item, i) => (
                <OngoingPunishmentBadge key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shop Performance Metrics - luôn hiển thị */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className={`w-4 h-4 ${hasData ? 'text-blue-500' : 'text-slate-400'}`} />
          <h4 className="text-sm font-semibold text-slate-800">Chi tiết chỉ số</h4>
          {performance?.overall_performance && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              PERFORMANCE_RATING[performance.overall_performance.rating]?.bg || 'bg-slate-100'
            } ${PERFORMANCE_RATING[performance.overall_performance.rating]?.color || 'text-slate-600'}`}>
              {PERFORMANCE_RATING[performance.overall_performance.rating]?.label || '---'}
            </span>
          )}
        </div>

        {/* Failed metrics summary */}
        {performance?.overall_performance && (
          performance.overall_performance.fulfillment_failed > 0 ||
          performance.overall_performance.listing_failed > 0 ||
          performance.overall_performance.custom_service_failed > 0
        ) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {performance.overall_performance.fulfillment_failed > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-50 text-red-600">
                <Truck className="w-3 h-3" />
                {performance.overall_performance.fulfillment_failed} chỉ số vận hành chưa đạt
              </span>
            )}
            {performance.overall_performance.listing_failed > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-50 text-red-600">
                <Package className="w-3 h-3" />
                {performance.overall_performance.listing_failed} chỉ số SP chưa đạt
              </span>
            )}
            {performance.overall_performance.custom_service_failed > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-50 text-red-600">
                <MessageCircle className="w-3 h-3" />
                {performance.overall_performance.custom_service_failed} chỉ số CSKH chưa đạt
              </span>
            )}
          </div>
        )}

        {/* Metrics grouped by type */}
        <div className="space-y-2">
          {[1, 2, 3].map(type => {
            const metrics = metricsByType[type];
            const config = METRIC_TYPE_LABELS[type];
            const Icon = config.icon;
            const isExpanded = expandedMetricTypes.has(type);
            const hasMetrics = metrics && metrics.length > 0;

            return (
              <div key={type} className="border border-slate-100 rounded-lg overflow-hidden">
                <button
                  onClick={() => hasMetrics && toggleMetricType(type)}
                  className={`w-full flex items-center gap-2 px-4 py-3 bg-slate-50 transition-colors ${hasMetrics ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 flex-1 text-left">{config.label}</span>
                  <span className="text-xs text-slate-400">
                    {hasMetrics ? `${metrics.length} chỉ số` : '---'}
                  </span>
                  {hasMetrics && (
                    isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )
                  )}
                </button>
                {hasMetrics && isExpanded && (
                  <div className="px-4 divide-y divide-slate-50">
                    {/* Header row */}
                    <div className="flex items-center gap-3 py-2 text-[10px] uppercase tracking-wider text-slate-400">
                      <div className="flex-1">Chỉ số</div>
                      <div className="w-20 text-right">Shop của tôi</div>
                      <div className="w-5" />
                      <div className="w-20 text-right">Chỉ tiêu</div>
                      <div className="w-6" />
                    </div>
                    {metrics.map(metric => (
                      <MetricRow key={metric.metric_id} metric={metric} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Penalty Point History */}
      {penaltyHistory?.penalty_point_list && penaltyHistory.penalty_point_list.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <button
            onClick={() => setShowPenaltyHistory(!showPenaltyHistory)}
            className="w-full flex items-center gap-2 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h4 className="text-sm font-semibold text-slate-800 flex-1 text-left">
              Lịch sử điểm phạt ({penaltyHistory.total_count})
            </h4>
            {showPenaltyHistory ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showPenaltyHistory && (
            <div className="mt-3 space-y-2">
              {penaltyHistory.penalty_point_list.map((record: PenaltyPointRecord, i: number) => (
                <div key={`${record.reference_id}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      {VIOLATION_TYPE_VI[record.violation_type] || `Vi phạm #${record.violation_type}`}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(record.issue_time)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-600">+{record.latest_point_num}</p>
                    {record.latest_point_num !== record.original_point_num && (
                      <p className="text-xs text-slate-400 line-through">+{record.original_point_num}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Punishment History */}
      {allPunishments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              Lịch sử xử phạt ({ongoingCount} đang áp dụng, {completedCount} đã hoàn thành)
            </h4>
          </div>

          <div className="space-y-2">
            {displayPunishments.map((item, i) => (
              <PunishmentCard key={`${item.reference_id}-${i}`} item={item} />
            ))}
          </div>

          {allPunishments.length > 3 && (
            <button
              onClick={() => setShowAllPunishments(!showAllPunishments)}
              className="mt-3 flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
            >
              {showAllPunishments ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Thu gọn
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Xem tất cả ({allPunishments.length})
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Listings with Issues */}
      {data?.listingsIssues?.response?.listing_list && data.listingsIssues.response.listing_list.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-orange-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              Sản phẩm có vấn đề ({listingsCount})
            </h4>
          </div>
          <div className="space-y-2">
            {data.listingsIssues.response.listing_list.map((item: ListingIssue, i: number) => (
              <div key={`${item.item_id}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">Item #{item.item_id}</p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-200 text-orange-800 flex-shrink-0">
                  {LISTING_ISSUE_REASONS[item.reason] || `Lý do #${item.reason}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Late Orders */}
      {data?.lateOrders?.response?.late_order_list && data.lateOrders.response.late_order_list.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              Đơn hàng trễ hạn ({lateOrdersCount})
            </h4>
          </div>
          <div className="space-y-2">
            {data.lateOrders.response.late_order_list.map((order: LateOrder, i: number) => (
              <div key={`${order.order_sn}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{order.order_sn}</p>
                  <p className="text-xs text-slate-400">Hạn: {formatDate(order.shipping_deadline)}</p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-200 text-red-800 flex-shrink-0">
                  Trễ {order.late_by_days} ngày
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chưa có data - hint */}
      {!hasData && !isLoading && !isFetching && !isError && (
        <div className="text-center py-4">
          <p className="text-xs text-slate-400">Bấm "Đồng bộ" để lấy dữ liệu từ Shopee</p>
        </div>
      )}

      {/* API Health Meta */}
      {data?._meta && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            API: {data._meta.success}/{data._meta.total_apis} thành công
            {cachedAt && !isFetching && ' (từ cache)'}
          </span>
          <span>
            Cập nhật: {new Date(data._meta.timestamp).toLocaleString('vi-VN', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
}
