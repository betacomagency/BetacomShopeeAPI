/**
 * Ads Campaign Panel - Quản lý chiến dịch quảng cáo Shopee Ads
 * Kiểm tra ads app authorization trước khi hiển thị campaigns
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimpleDataTable, CellBadge, CellText } from '@/components/ui/data-table';
import { toast } from 'sonner';
import {
  Megaphone,
  RefreshCw,
  AlertCircle,
  Play,
  Pause,
  DollarSign,
  Link2,
} from 'lucide-react';
import { getAdsCampaigns, toggleCampaignStatus } from '@/lib/shopee/ads-client';
import { getShopAppAuthStatuses, getAppAuthUrl } from '@/lib/shopee/app-auth-client';
import type { ShopAppAuthStatus } from '@/lib/shopee/partner-apps';

interface AdsCampaignPanelProps {
  shopId: number;
}

interface CampaignItem {
  campaign_id: number;
  campaign_type?: string;
  title?: string;
  status?: string;
  daily_budget?: number;
  state?: string;
}

export function AdsCampaignPanel({ shopId }: AdsCampaignPanelProps) {
  const [loading, setLoading] = useState(true);
  const [adsStatus, setAdsStatus] = useState<ShopAppAuthStatus | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectingAds, setConnectingAds] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Check ads app authorization
  const checkAdsAuth = useCallback(async () => {
    try {
      const statuses = await getShopAppAuthStatuses(shopId);
      const adsApp = statuses.find(s => s.partner_app.app_category === 'ads');
      setAdsStatus(adsApp || null);
      return adsApp?.is_authorized || false;
    } catch (err) {
      console.error('Error checking ads auth:', err);
      return false;
    }
  }, [shopId]);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isAuthorized = await checkAdsAuth();
      if (!isAuthorized) {
        setLoading(false);
        return;
      }

      const result = await getAdsCampaigns(shopId);
      const responseData = result.response?.data as Record<string, unknown>;

      if (responseData?.error && responseData.error !== '' && responseData.error !== 'success') {
        setError(`Shopee API error: ${responseData.message || responseData.error}`);
        setCampaigns([]);
      } else {
        // Shopee returns campaigns in different formats depending on the API version
        const entries = (responseData?.entry_list || responseData?.ads_list || []) as CampaignItem[];
        setCampaigns(entries);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Không thể tải chiến dịch');
    } finally {
      setLoading(false);
    }
  }, [shopId, checkAdsAuth]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Connect ads app
  const handleConnectAds = async () => {
    if (!adsStatus?.partner_app) {
      toast.error('Không tìm thấy Ads App. Liên hệ admin để cấu hình.');
      return;
    }

    setConnectingAds(true);
    try {
      const callbackUrl = `${window.location.origin}/auth/callback`;
      sessionStorage.setItem('shopee_partner_app_id', adsStatus.partner_app.id);
      sessionStorage.setItem('shopee_partner_app_name', adsStatus.partner_app.partner_name);

      const authUrl = await getAppAuthUrl(adsStatus.partner_app.id, callbackUrl);
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error connecting ads app:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể kết nối Ads App');
      sessionStorage.removeItem('shopee_partner_app_id');
      sessionStorage.removeItem('shopee_partner_app_name');
      setConnectingAds(false);
    }
  };

  // Toggle campaign status
  const handleToggle = async (campaignId: number, currentStatus: string) => {
    const enable = currentStatus !== 'ongoing';
    setTogglingId(campaignId);
    try {
      await toggleCampaignStatus(shopId, campaignId, enable);
      toast.success(enable ? 'Đã bật chiến dịch' : 'Đã tạm dừng chiến dịch');
      fetchCampaigns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi cập nhật chiến dịch');
    } finally {
      setTogglingId(null);
    }
  };

  // Not authorized state
  if (!loading && adsStatus && !adsStatus.is_authorized) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-800">Quảng cáo Shopee Ads</h2>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Shop chưa kết nối với ứng dụng <strong>Betacom Ads</strong>.
              Bạn cần ủy quyền app Ads để sử dụng tính năng quảng cáo.
            </span>
            <Button
              size="sm"
              onClick={handleConnectAds}
              disabled={connectingAds}
              className="w-fit cursor-pointer"
            >
              {connectingAds ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Kết nối Betacom Ads
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No ads app configured at all
  if (!loading && !adsStatus) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-slate-800">Quảng cáo Shopee Ads</h2>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Chưa có ứng dụng Ads được cấu hình trong hệ thống. Liên hệ admin để thêm Partner App loại "Ads Service".
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatBudget = (budget?: number) => {
    if (!budget) return '-';
    // Shopee budget in micro-currency units
    const amount = budget / 100000;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ongoing':
        return <CellBadge variant="success">Đang chạy</CellBadge>;
      case 'paused':
        return <CellBadge variant="warning">Tạm dừng</CellBadge>;
      case 'schedule':
      case 'scheduled':
        return <CellBadge variant="default">Lên lịch</CellBadge>;
      case 'ended':
      case 'closed':
        return <CellBadge variant="destructive">Đã kết thúc</CellBadge>;
      default:
        return <CellBadge variant="default">{status || '-'}</CellBadge>;
    }
  };

  const columns = [
    {
      key: 'campaign_id',
      header: 'ID',
      width: '100px',
      render: (item: CampaignItem) => (
        <CellText className="font-mono text-xs">{item.campaign_id}</CellText>
      ),
    },
    {
      key: 'title',
      header: 'Tên chiến dịch',
      width: '250px',
      mobileHeader: true,
      render: (item: CampaignItem) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{item.title || `Campaign ${item.campaign_id}`}</p>
          {item.campaign_type && (
            <p className="text-xs text-slate-500">{item.campaign_type}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      mobileBadge: true,
      render: (item: CampaignItem) => getStatusBadge(item.status),
    },
    {
      key: 'budget',
      header: 'Ngân sách/ngày',
      width: '140px',
      hideOnMobile: true,
      render: (item: CampaignItem) => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-green-500" />
          <CellText>{formatBudget(item.daily_budget)}</CellText>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (item: CampaignItem) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 cursor-pointer"
          onClick={() => handleToggle(item.campaign_id, item.status || '')}
          disabled={togglingId === item.campaign_id}
          title={item.status === 'ongoing' ? 'Tạm dừng' : 'Bật'}
        >
          {togglingId === item.campaign_id ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : item.status === 'ongoing' ? (
            <Pause className="w-3.5 h-3.5 text-yellow-500" />
          ) : (
            <Play className="w-3.5 h-3.5 text-green-500" />
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4 bg-white min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-orange-500" />
            Quảng cáo Shopee Ads
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý chiến dịch quảng cáo
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCampaigns}
          disabled={loading}
          className="cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Làm mới</span>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Campaign Table */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="border rounded-lg overflow-hidden">
          <SimpleDataTable
            columns={columns}
            data={campaigns}
            keyExtractor={(item) => item.campaign_id.toString()}
            loading={loading}
            loadingMessage="Đang tải chiến dịch..."
            emptyMessage="Chưa có chiến dịch nào"
            emptyDescription="Tạo chiến dịch quảng cáo trên Shopee Seller Center để quản lý tại đây"
          />
        </div>
      </div>
    </div>
  );
}
