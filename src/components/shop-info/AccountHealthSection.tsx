/**
 * Account Health Section - Hiệu quả hoạt động shop
 * Hiển thị: Điểm phạt, Lịch sử xử phạt, Sản phẩm có vấn đề, Đơn hàng trễ
 */

import { useAccountHealth } from '@/hooks/useAccountHealth';
import type { Punishment } from '@/hooks/useAccountHealth';
import {
  AlertTriangle, ShieldCheck, ShieldAlert, Package, Clock,
  RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

interface AccountHealthSectionProps {
  shopId: number;
}

// Punishment reason mapping
const PUNISHMENT_REASONS: Record<number, string> = {
  1: 'Vi phạm chính sách',
  2: 'Hàng cấm/hạn chế',
  3: 'Vi phạm sở hữu trí tuệ',
  4: 'Spam/lạm dụng',
  5: 'Gian lận',
};

// Punishment type mapping
const PUNISHMENT_TYPES: Record<number, string> = {
  101: 'Cảnh cáo',
  102: 'Giới hạn đăng bán',
  103: 'Hạ điểm shop',
  104: 'Tạm khóa',
  105: 'Hạn chế tính năng',
  106: 'Giảm hiển thị',
  107: 'Hạn chế đăng sản phẩm',
  108: 'Hạn chế tham gia khuyến mãi',
  109: 'Hạn chế rút tiền',
};

function formatDate(ts: number): string {
  if (!ts) return '---';
  return new Date(ts * 1000).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

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
      </div>
    </div>
  );
}

export function AccountHealthSection({ shopId }: AccountHealthSectionProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useAccountHealth(shopId);
  const [showAllPunishments, setShowAllPunishments] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
          <span className="text-sm text-slate-500">Đang tải hiệu quả hoạt động...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-slate-600">Không thể tải dữ liệu</p>
            <p className="text-xs text-slate-400">{error?.message}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const penaltyCount = data.penaltyPoints?.response?.total_count ?? 0;
  const ongoingCount = data.punishmentOngoing?.response?.total_count ?? 0;
  const completedCount = data.punishmentCompleted?.response?.total_count ?? 0;
  const listingsCount = data.listingsIssues?.response?.total_count ?? 0;
  const lateOrdersCount = data.lateOrders?.response?.total_count ?? 0;

  const hasAnyIssue = penaltyCount > 0 || ongoingCount > 0 || listingsCount > 0 || lateOrdersCount > 0;

  // Combine ongoing + completed punishments
  const allPunishments = [
    ...(data.punishmentOngoing?.response?.punishment_list || []),
    ...(data.punishmentCompleted?.response?.punishment_list || []),
  ].sort((a, b) => b.issue_time - a.issue_time);

  const displayPunishments = showAllPunishments ? allPunishments : allPunishments.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasAnyIssue ? (
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          )}
          <h3 className="font-semibold text-slate-800">Hiệu quả hoạt động</h3>
          {hasAnyIssue ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
              Cần chú ý
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
              Tốt
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Penalty Points */}
        <div className={`rounded-xl border p-4 ${penaltyCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${penaltyCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">Điểm phạt</span>
          </div>
          <p className={`text-2xl font-bold ${penaltyCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {penaltyCount}
          </p>
        </div>

        {/* Ongoing Punishments */}
        <div className={`rounded-xl border p-4 ${ongoingCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className={`w-4 h-4 ${ongoingCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">Đang xử phạt</span>
          </div>
          <p className={`text-2xl font-bold ${ongoingCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {ongoingCount}
          </p>
        </div>

        {/* Listings Issues */}
        <div className={`rounded-xl border p-4 ${listingsCount > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Package className={`w-4 h-4 ${listingsCount > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">SP có vấn đề</span>
          </div>
          <p className={`text-2xl font-bold ${listingsCount > 0 ? 'text-orange-600' : 'text-slate-800'}`}>
            {listingsCount}
          </p>
        </div>

        {/* Late Orders */}
        <div className={`rounded-xl border p-4 ${lateOrdersCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${lateOrdersCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className="text-xs text-slate-500">Đơn trễ hạn</span>
          </div>
          <p className={`text-2xl font-bold ${lateOrdersCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {lateOrdersCount}
          </p>
        </div>
      </div>

      {/* All good message */}
      {!hasAnyIssue && (
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

      {/* API Health Meta */}
      {data._meta && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            API: {data._meta.success}/{data._meta.total_apis} thành công
          </span>
          <span>
            Cập nhật: {new Date(data._meta.timestamp).toLocaleTimeString('vi-VN')}
          </span>
        </div>
      )}
    </div>
  );
}
