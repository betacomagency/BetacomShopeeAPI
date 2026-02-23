/**
 * Shop Info Content - Nội dung chi tiết thông tin shop
 * Dùng chung cho cả trang riêng và dialog
 * Dữ liệu từ GET /api/v2/shop/get_shop_info + GET /api/v2/shop/get_profile
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Store,
  Globe,
  Clock,
  Hash,
  CheckCircle2,
  XCircle,
  Link2,
  Package,
  ShieldCheck,
} from 'lucide-react';
import type {
  SipAffiShop,
  LinkedDirectShop,
  OutletShopInfo,
} from '@/lib/shopee/types';

// ==================== Types ====================

interface ShopInfoContentProps {
  shopId: number | null;
  initialShopName?: string | null;
  initialShopLogo?: string | null;
  /** 'page' = full page layout, 'dialog' = compact dialog layout */
  variant?: 'page' | 'dialog';
}

interface ShopFullInfoData {
  info: {
    error?: string;
    message?: string;
    request_id?: string;
    shop_name?: string;
    region?: string;
    status?: string;
    is_cb?: boolean;
    is_sip?: boolean;
    is_upgraded_cbsc?: boolean;
    is_main_shop?: boolean;
    is_direct_shop?: boolean;
    is_one_awb?: boolean;
    is_mart_shop?: boolean;
    is_outlet_shop?: boolean;
    merchant_id?: number | null;
    shop_fulfillment_flag?: string;
    linked_main_shop_id?: number;
    mart_shop_id?: number;
    auth_time?: number;
    expire_time?: number;
    sip_affi_shops?: SipAffiShop[];
    linked_direct_shop_list?: LinkedDirectShop[];
    outlet_shop_info_list?: OutletShopInfo[];
  };
  profile: {
    error?: string;
    message?: string;
    request_id?: string;
    response?: {
      shop_logo?: string;
      description?: string;
      shop_name?: string;
    };
  };
  cached: boolean;
  cached_at?: string;
}

// ==================== Helper Components ====================

function formatTimestamp(ts: number | undefined | null): string {
  if (!ts) return '-';
  const date = new Date(ts * 1000);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">-</Badge>;

  const styles: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-700 border-green-200',
    FROZEN: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    BANNED: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <Badge className={styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}>
      {status}
    </Badge>
  );
}

function FlagItem({ label, value }: { label: string; value: boolean | null | undefined }) {
  const isTrue = value === true;
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      {isTrue ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Có
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
          <XCircle className="w-3.5 h-3.5" />
          Không
        </span>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">
        {value || '-'}
      </span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-slate-500" />
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h4>
    </div>
  );
}

// ==================== Main Component ====================

export function ShopInfoContent({
  shopId,
  initialShopName,
  initialShopLogo,
  variant = 'page',
}: ShopInfoContentProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShopFullInfoData | null>(null);

  const fetchShopInfo = useCallback(async (forceRefresh = false) => {
    if (!shopId) return;

    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data: result, error: fetchError } = await supabase.functions.invoke('shopee-shop', {
        body: { action: 'get-full-info', shop_id: shopId, force_refresh: forceRefresh },
      });

      if (fetchError) throw fetchError;

      if (result?.info?.error && result.info.error !== '') {
        setError(`${result.info.error}: ${result.info.message || ''}`);
      }

      setData(result as ShopFullInfoData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      setData(null);
      fetchShopInfo(false);
    }
  }, [shopId, fetchShopInfo]);

  const info = data?.info;
  const profile = data?.profile?.response;
  const shopLogo = profile?.shop_logo || initialShopLogo;
  const shopName = info?.shop_name || initialShopName;

  const isPage = variant === 'page';

  // ==================== Header ====================
  const header = (
    <div className={`flex items-start gap-4 ${isPage ? 'mb-6' : 'px-6 pt-6 pb-3'}`}>
      {shopLogo ? (
        <img
          src={shopLogo}
          alt={shopName || 'Shop logo'}
          className={`${isPage ? 'w-16 h-16' : 'w-10 h-10'} rounded-lg object-cover border border-slate-200 dark:border-slate-700`}
        />
      ) : (
        <div className={`${isPage ? 'w-16 h-16' : 'w-10 h-10'} rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}>
          <Store className={`${isPage ? 'w-7 h-7' : 'w-5 h-5'} text-slate-400`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className={`${isPage ? 'text-xl' : 'text-base'} font-semibold truncate text-slate-900 dark:text-slate-100`}>
            {shopName || `Shop ${shopId}`}
          </h2>
          <StatusBadge status={info?.status} />
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-sm text-slate-500 font-mono">ID: {shopId}</span>
          {info?.region && (
            <Badge variant="outline" className="text-xs">
              <Globe className="w-3 h-3 mr-1" />
              {info.region}
            </Badge>
          )}
          {data?.cached && (
            <span className="text-xs text-slate-400">
              Bộ nhớ đệm {data.cached_at ? formatTimestamp(Math.floor(new Date(data.cached_at).getTime() / 1000)) : ''}
            </span>
          )}
        </div>
        {profile?.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            {profile.description}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 cursor-pointer"
        onClick={() => fetchShopInfo(true)}
        disabled={refreshing}
        title="Làm mới từ Shopee API"
      >
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
        Làm mới
      </Button>
    </div>
  );

  // ==================== Body Content ====================
  const bodyContent = loading ? (
    <div className="flex items-center justify-center py-12">
      <Spinner className="w-6 h-6" />
    </div>
  ) : error && !data ? (
    <div className="text-center py-8">
      <p className="text-sm text-red-500">{error}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 cursor-pointer"
        onClick={() => fetchShopInfo(true)}
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Thử lại
      </Button>
    </div>
  ) : info ? (
    <div className={`space-y-4 ${isPage ? '' : 'px-6 pb-6'}`}>
      {error && (
        <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Shop Flags */}
      {isPage ? (
        <Card>
          <CardContent className="pt-4 pb-3">
            <SectionTitle icon={ShieldCheck} title="Thuộc tính Shop" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4">
              <FlagItem label="Xuyên biên giới" value={info.is_cb} />
              <FlagItem label="SIP" value={info.is_sip} />
              <FlagItem label="Nâng cấp CBSC" value={info.is_upgraded_cbsc} />
              <FlagItem label="Shop chính" value={info.is_main_shop} />
              <FlagItem label="Shop trực tiếp" value={info.is_direct_shop} />
              <FlagItem label="1-AWB" value={info.is_one_awb} />
              <FlagItem label="Mart Shop" value={info.is_mart_shop} />
              <FlagItem label="Outlet Shop" value={info.is_outlet_shop} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          <SectionTitle icon={ShieldCheck} title="Thuộc tính Shop" />
          <div className="grid grid-cols-2 gap-x-4">
            <FlagItem label="Xuyên biên giới" value={info.is_cb} />
            <FlagItem label="SIP" value={info.is_sip} />
            <FlagItem label="Nâng cấp CBSC" value={info.is_upgraded_cbsc} />
            <FlagItem label="Shop chính" value={info.is_main_shop} />
            <FlagItem label="Shop trực tiếp" value={info.is_direct_shop} />
            <FlagItem label="1-AWB" value={info.is_one_awb} />
            <FlagItem label="Mart Shop" value={info.is_mart_shop} />
            <FlagItem label="Outlet Shop" value={info.is_outlet_shop} />
          </div>
        </div>
      )}

      {!isPage && <Separator />}

      {/* Details + Timestamps */}
      {isPage ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <SectionTitle icon={Hash} title="Chi tiết" />
              <div className="space-y-0.5">
                <InfoRow label="Merchant ID" value={info.merchant_id ?? '-'} />
                <InfoRow
                  label="Vận chuyển"
                  value={
                    info.shop_fulfillment_flag ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {info.shop_fulfillment_flag}
                      </Badge>
                    ) : '-'
                  }
                />
                {info.linked_main_shop_id ? (
                  <InfoRow label="Shop chính liên kết" value={info.linked_main_shop_id} />
                ) : null}
                {info.mart_shop_id ? (
                  <InfoRow label="Mart Shop ID" value={info.mart_shop_id} />
                ) : null}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <SectionTitle icon={Clock} title="Thời gian ủy quyền" />
              <div className="space-y-0.5">
                <InfoRow label="Ngày ủy quyền" value={formatTimestamp(info.auth_time)} />
                <InfoRow label="Hết hạn" value={formatTimestamp(info.expire_time)} />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div>
            <SectionTitle icon={Hash} title="Chi tiết" />
            <div className="space-y-0.5">
              <InfoRow label="Merchant ID" value={info.merchant_id ?? '-'} />
              <InfoRow
                label="Vận chuyển"
                value={
                  info.shop_fulfillment_flag ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      {info.shop_fulfillment_flag}
                    </Badge>
                  ) : '-'
                }
              />
              {info.linked_main_shop_id ? (
                <InfoRow label="Shop chính liên kết" value={info.linked_main_shop_id} />
              ) : null}
              {info.mart_shop_id ? (
                <InfoRow label="Mart Shop ID" value={info.mart_shop_id} />
              ) : null}
            </div>
          </div>
          <Separator />
          <div>
            <SectionTitle icon={Clock} title="Thời gian ủy quyền" />
            <div className="space-y-0.5">
              <InfoRow label="Ngày ủy quyền" value={formatTimestamp(info.auth_time)} />
              <InfoRow label="Hết hạn" value={formatTimestamp(info.expire_time)} />
            </div>
          </div>
        </>
      )}

      {/* Related Shops */}
      {((info.sip_affi_shops && info.sip_affi_shops.length > 0) ||
        (info.linked_direct_shop_list && info.linked_direct_shop_list.length > 0) ||
        (info.outlet_shop_info_list && info.outlet_shop_info_list.length > 0)) && (
        <>
          {!isPage && <Separator />}
          {isPage ? (
            <Card>
              <CardContent className="pt-4 pb-3">
                <SectionTitle icon={Link2} title="Shop liên kết" />
                <RelatedShopsList info={info} />
              </CardContent>
            </Card>
          ) : (
            <div>
              <SectionTitle icon={Link2} title="Shop liên kết" />
              <RelatedShopsList info={info} />
            </div>
          )}
        </>
      )}

      {/* Fulfillment Detail */}
      {info.shop_fulfillment_flag && info.shop_fulfillment_flag !== 'Others' && info.shop_fulfillment_flag !== 'Unknown' && (
        <>
          {!isPage && <Separator />}
          {isPage ? (
            <Card>
              <CardContent className="pt-4 pb-3">
                <SectionTitle icon={Package} title="Hình thức vận chuyển" />
                <p className="text-sm text-slate-600 dark:text-slate-400 px-2">
                  {info.shop_fulfillment_flag}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div>
              <SectionTitle icon={Package} title="Hình thức vận chuyển" />
              <p className="text-sm text-slate-600 dark:text-slate-400 px-2">
                {info.shop_fulfillment_flag}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  ) : null;

  // ==================== Render ====================
  if (isPage) {
    return (
      <div>
        {header}
        {bodyContent}
      </div>
    );
  }

  // Dialog variant
  return (
    <>
      {header}
      <ScrollArea className="max-h-[calc(85vh-140px)]">
        {bodyContent}
      </ScrollArea>
    </>
  );
}

// ==================== Related Shops Sub-component ====================

function RelatedShopsList({ info }: { info: ShopFullInfoData['info'] }) {
  return (
    <div className="space-y-3">
      {info.sip_affi_shops && info.sip_affi_shops.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5 px-2">
            SIP Affiliate Shops ({info.sip_affi_shops.length})
          </p>
          <div className="space-y-1">
            {info.sip_affi_shops.map((shop: SipAffiShop, i: number) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 text-sm bg-slate-50 dark:bg-slate-800/50 rounded">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {shop.affi_shop_id}
                </span>
                <Badge variant="outline" className="text-xs">
                  {shop.region}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {info.linked_direct_shop_list && info.linked_direct_shop_list.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5 px-2">
            Linked Direct Shops ({info.linked_direct_shop_list.length})
          </p>
          <div className="space-y-1">
            {info.linked_direct_shop_list.map((shop: LinkedDirectShop, i: number) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 text-sm bg-slate-50 dark:bg-slate-800/50 rounded">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {shop.direct_shop_id}
                </span>
                <Badge variant="outline" className="text-xs">
                  {shop.direct_shop_region}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {info.outlet_shop_info_list && info.outlet_shop_info_list.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5 px-2">
            Outlet Shops ({info.outlet_shop_info_list.length})
          </p>
          <div className="space-y-1">
            {info.outlet_shop_info_list.map((shop: OutletShopInfo, i: number) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 text-sm bg-slate-50 dark:bg-slate-800/50 rounded">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {shop.outlet_shop_id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
