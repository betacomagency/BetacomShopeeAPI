/**
 * ShopAppConnectionStatus - Shows per-app authorization status for a shop
 * Displays which partner apps (ERP, Ads) are connected and their token status
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { CellBadge } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';

interface PartnerApp {
  id: string;
  partner_id: number;
  partner_name: string;
  app_category: string;
}

interface AppToken {
  id: string;
  shop_id: number;
  partner_app_id: string;
  expired_at: number | null;
  token_updated_at: string | null;
  apishopee_partner_apps: PartnerApp;
}

interface ShopAppConnectionStatusProps {
  shopId: number; // Shopee numeric shop_id
  onConnectApp?: (partnerApp: PartnerApp) => void;
  compact?: boolean; // Compact mode for table rows
}

/**
 * Displays per-app auth status for a shop.
 * Shows connected/not-connected badge per partner app with token expiry info.
 */
export function ShopAppConnectionStatus({ shopId, onConnectApp, compact = false }: ShopAppConnectionStatusProps) {
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);
  const [appTokens, setAppTokens] = useState<AppToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const loadAppStatus = async () => {
    try {
      // Load partner apps and app tokens in parallel
      const [appsResult, tokensResult] = await Promise.all([
        supabase
          .from('apishopee_partner_apps')
          .select('id, partner_id, partner_name, app_category')
          .eq('is_active', true)
          .order('app_category'),
        supabase
          .from('apishopee_shop_app_tokens')
          .select('id, shop_id, partner_app_id, expired_at, token_updated_at, apishopee_partner_apps!inner(id, partner_id, partner_name, app_category)')
          .eq('shop_id', shopId),
      ]);

      if (appsResult.data) setPartnerApps(appsResult.data as PartnerApp[]);
      if (tokensResult.data) setAppTokens(tokensResult.data as unknown as AppToken[]);
    } catch {
      // Silently fail - tables may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const getTokenStatus = (token: AppToken | undefined): { label: string; variant: 'success' | 'warning' | 'destructive' } => {
    if (!token) return { label: 'Chưa kết nối', variant: 'destructive' };
    if (!token.expired_at) return { label: 'Đã kết nối', variant: 'success' };

    // expired_at stored in milliseconds (matches Date.now())
    const now = Date.now();
    if (token.expired_at <= now) return { label: 'Token hết hạn', variant: 'warning' };
    return { label: 'Đã kết nối', variant: 'success' };
  };

  if (loading) return <Spinner size="sm" />;
  if (partnerApps.length === 0) return null; // No partner apps registered

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'erp': return 'ERP';
      case 'ads': return 'Ads';
      default: return category.toUpperCase();
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {partnerApps.map(app => {
          const token = appTokens.find(t => t.partner_app_id === app.id);
          const status = getTokenStatus(token);
          return (
            <CellBadge key={app.id} variant={status.variant}>
              {getCategoryLabel(app.app_category)}
            </CellBadge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {partnerApps.map(app => {
        const token = appTokens.find(t => t.partner_app_id === app.id);
        const status = getTokenStatus(token);
        const isConnected = !!token;

        return (
          <div key={app.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{app.partner_name}</span>
              <CellBadge variant={status.variant}>
                {status.label}
              </CellBadge>
            </div>
            {!isConnected && onConnectApp && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs cursor-pointer"
                onClick={() => onConnectApp(app)}
              >
                Kết nối
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook to load partner apps from database.
 * Returns active partner apps for use in connect dialogs.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePartnerApps() {
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('apishopee_partner_apps')
      .select('id, partner_id, partner_name, app_category')
      .eq('is_active', true)
      .order('app_category')
      .then(({ data }) => {
        if (data) setPartnerApps(data as PartnerApp[]);
        setLoading(false);
      });
  }, []);

  return { partnerApps, loading };
}

export type { PartnerApp, AppToken };
