/**
 * Shop App Authorization Panel
 * Hiển thị trạng thái kết nối các Partner Apps cho mỗi shop
 * Cho phép ủy quyền shop với từng app riêng (ERP, Ads, ...)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CellBadge } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { Link2, ExternalLink, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { getShopAppAuthStatuses, getAppAuthUrl } from '@/lib/shopee/app-auth-client';
import type { ShopAppAuthStatus } from '@/lib/shopee/partner-apps';
import { APP_CATEGORY_LABELS, APP_CATEGORY_COLORS } from '@/lib/shopee/partner-apps';

interface ShopAppAuthPanelProps {
  shopId: number;
  shopName?: string;
}

const TOKEN_STATUS_CONFIG = {
  active: { label: 'Đã kết nối', variant: 'success' as const, Icon: CheckCircle },
  expiring: { label: 'Sắp hết hạn', variant: 'warning' as const, Icon: Clock },
  expired: { label: 'Hết hạn', variant: 'destructive' as const, Icon: AlertCircle },
  not_authorized: { label: 'Chưa kết nối', variant: 'default' as const, Icon: AlertCircle },
};

export function ShopAppAuthPanel({ shopId, shopName }: ShopAppAuthPanelProps) {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<ShopAppAuthStatus[]>([]);
  const [connectingAppId, setConnectingAppId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatuses = async () => {
      setLoading(true);
      try {
        const data = await getShopAppAuthStatuses(shopId);
        setStatuses(data);
      } catch (error) {
        console.error('Error fetching app auth statuses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatuses();
  }, [shopId]);

  const handleConnect = async (appId: string, appName: string) => {
    setConnectingAppId(appId);
    try {
      // Build callback URL
      const callbackUrl = `${window.location.origin}/auth/callback`;

      // Store partner_app_id in sessionStorage for callback to pick up
      sessionStorage.setItem('shopee_partner_app_id', appId);
      sessionStorage.setItem('shopee_partner_app_name', appName);

      // Get OAuth URL from edge function
      const authUrl = await getAppAuthUrl(appId, callbackUrl);

      // Redirect to Shopee OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error starting app auth:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể bắt đầu ủy quyền');
      // Clean up sessionStorage on error
      sessionStorage.removeItem('shopee_partner_app_id');
      sessionStorage.removeItem('shopee_partner_app_name');
      setConnectingAppId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">
        Chưa có Partner App nào được cấu hình. Liên hệ admin để thêm.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">
        Ủy quyền shop {shopName ? `"${shopName}"` : `#${shopId}`} với các ứng dụng Shopee:
      </p>

      {statuses.map((status) => {
        const config = TOKEN_STATUS_CONFIG[status.token_status];
        const StatusIcon = config.Icon;

        return (
          <div
            key={status.partner_app.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {status.partner_app.partner_name}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${APP_CATEGORY_COLORS[status.partner_app.app_category]}`}>
                    {APP_CATEGORY_LABELS[status.partner_app.app_category]}
                  </span>
                </div>
                {status.partner_app.description && (
                  <p className="text-xs text-slate-500">{status.partner_app.description}</p>
                )}
                {status.token?.token_updated_at && (
                  <p className="text-[10px] text-slate-400">
                    Cập nhật: {new Date(status.token.token_updated_at).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CellBadge variant={config.variant}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </CellBadge>

              {status.token_status === 'not_authorized' || status.token_status === 'expired' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs cursor-pointer"
                  onClick={() => handleConnect(status.partner_app.id, status.partner_app.partner_name)}
                  disabled={connectingAppId === status.partner_app.id}
                >
                  {connectingAppId === status.partner_app.id ? (
                    <Spinner className="h-3 w-3 mr-1" />
                  ) : (
                    <Link2 className="w-3 h-3 mr-1" />
                  )}
                  {status.token_status === 'expired' ? 'Kết nối lại' : 'Kết nối'}
                </Button>
              ) : status.token_status === 'expiring' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-50 cursor-pointer"
                  onClick={() => handleConnect(status.partner_app.id, status.partner_app.partner_name)}
                  disabled={connectingAppId === status.partner_app.id}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Gia hạn
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
