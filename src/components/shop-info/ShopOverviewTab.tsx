/**
 * Shop Overview Tab - Hiển thị tổng quan thông tin shop
 */

import type { ShopAllData } from '@/hooks/useShopInfo';
import {
  Store, Shield, Globe, Truck, Calendar,
  CheckCircle2, XCircle, Clock, MapPin,
} from 'lucide-react';


interface ShopOverviewTabProps {
  data: ShopAllData;
  shopId: number;
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    NORMAL: 'bg-emerald-100 text-emerald-700',
    BANNED: 'bg-red-100 text-red-700',
    FROZEN: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

function FlagBadge({ label, value }: { label: string; value?: boolean | null }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center gap-2 py-1.5">
      {value ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
      )}
      <span className={`text-sm ${value ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function formatTimestamp(ts?: number | null): string {
  if (!ts) return '---';
  return new Date(ts * 1000).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDaysRemaining(expireTime?: number | null): { days: number; percent: number } | null {
  if (!expireTime) return null;
  const now = Math.floor(Date.now() / 1000);
  const remaining = expireTime - now;
  const days = Math.max(0, Math.floor(remaining / 86400));
  const totalDays = 365;
  const percent = Math.min(100, Math.max(0, (days / totalDays) * 100));
  return { days, percent };
}

export function ShopOverviewTab({ data, shopId }: ShopOverviewTabProps) {
  const info = data.info;
  const profile = data.profile;
  const holiday = data.holidayMode;
  const authRemaining = getDaysRemaining(info?.expire_time);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
      {/* Shop Identity */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          {profile?.response?.shop_logo ? (
            <img
              src={profile.response.shop_logo}
              alt={info?.shop_name || 'Shop'}
              className="w-16 h-16 rounded-xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
              <Store className="w-8 h-8 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 truncate">
                {info?.shop_name || `Shop #${shopId}`}
              </h2>
              <StatusBadge status={info?.status} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Shop ID: <span className="font-mono font-medium">{shopId}</span>
              {info?.merchant_id && (
                <> &middot; Merchant ID: <span className="font-mono font-medium">{info.merchant_id}</span></>
              )}
            </p>
            {profile?.response?.description && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{profile.response.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Authorization & Token */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-slate-800">Ủy quyền & Token</h3>
          </div>
          <div className="space-y-0.5">
            <InfoRow label="Khu vực" value={info?.region} />
            <InfoRow label="Ngày ủy quyền" value={formatTimestamp(info?.auth_time)} />
            <InfoRow label="Hết hạn ủy quyền" value={formatTimestamp(info?.expire_time)} />
          </div>
          {authRemaining && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500">Thời hạn còn lại</span>
                <span className={`font-medium ${authRemaining.days < 30 ? 'text-red-600' : authRemaining.days < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {authRemaining.days} ngày
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${authRemaining.days < 30 ? 'bg-red-500' : authRemaining.days < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${authRemaining.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Shop Flags */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-slate-800">Thuộc tính Shop</h3>
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            <FlagBadge label="Cross-border" value={info?.is_cb} />
            <FlagBadge label="SIP Affiliate" value={info?.is_sip} />
            <FlagBadge label="Main Shop" value={info?.is_main_shop} />
            <FlagBadge label="Direct Shop" value={info?.is_direct_shop} />
            <FlagBadge label="Upgraded CBSC" value={info?.is_upgraded_cbsc} />
            <FlagBadge label="Mart Shop" value={info?.is_mart_shop} />
            <FlagBadge label="Outlet Shop" value={info?.is_outlet_shop} />
            <FlagBadge label="One AWB" value={info?.is_one_awb} />
          </div>
          {info?.shop_fulfillment_flag && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">Fulfillment:</span>
                <span className="text-sm font-medium text-slate-700">{info.shop_fulfillment_flag}</span>
              </div>
            </div>
          )}
        </div>

        {/* Holiday Mode */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-slate-800">Chế độ nghỉ lễ</h3>
          </div>
          {holiday?.error ? (
            <p className="text-sm text-slate-400">Không thể lấy thông tin</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  holiday?.response?.holiday_mode_on
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {holiday?.response?.holiday_mode_on ? 'Đang bật' : 'Tắt'}
                </span>
              </div>
              {holiday?.response?.holiday_date_list && holiday.response.holiday_date_list.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Lịch nghỉ</p>
                  {holiday.response.holiday_date_list.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatTimestamp(d.date_from)} - {formatTimestamp(d.date_to)}
                    </div>
                  ))}
                </div>
              )}
              {(!holiday?.response?.holiday_date_list || holiday.response.holiday_date_list.length === 0) && !holiday?.response?.holiday_mode_on && (
                <p className="text-sm text-slate-400">Không có lịch nghỉ</p>
              )}
            </>
          )}
        </div>

        {/* Linked Shops */}
        {(info?.linked_main_shop_id || (info?.linked_direct_shop_list && info.linked_direct_shop_list.length > 0)) && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-slate-800">Shop liên kết</h3>
            </div>
            {info?.linked_main_shop_id && (
              <InfoRow label="Main Shop ID" value={info.linked_main_shop_id} />
            )}
            {info?.linked_direct_shop_list && info.linked_direct_shop_list.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-slate-500">Direct Shops: {info.linked_direct_shop_list.length}</span>
              </div>
            )}
          </div>
        )}

        {/* API Health Meta */}
        {data._meta && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-slate-800">API Health</h3>
            </div>
            <div className="space-y-0.5">
              <InfoRow label="Tổng API calls" value={data._meta.total_apis} />
              <InfoRow label="Thành công" value={data._meta.success} />
              <InfoRow label="Thất bại" value={data._meta.failed} />
              <InfoRow label="Lần cập nhật" value={new Date(data._meta.timestamp).toLocaleTimeString('vi-VN')} />
            </div>
            <div className="mt-3">
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(data._meta.success / data._meta.total_apis) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1 text-right">
                {Math.round((data._meta.success / data._meta.total_apis) * 100)}% success
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
