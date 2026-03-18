/**
 * Ads Campaign Panel - Quản lý chiến dịch quảng cáo Shopee Ads
 * Hiển thị danh sách campaigns, cho phép bật/tắt, xem chi tiết
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimpleDataTable, CellText, CellBadge } from '@/components/ui/data-table';
import { getAdsCampaigns, updateAdsCampaignStatus } from '@/lib/shopee/ads-client';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface Campaign {
  campaign_id: number;
  campaign_name: string;
  status: string; // 'ongoing' | 'paused' | 'ended' | 'budget_exceeded'
  campaign_type: number;
  daily_budget: number;
  total_budget: number;
  start_time: number;
  end_time: number;
}

interface AdsCampaignPanelProps {
  shopId: number;
}

const CAMPAIGN_TYPE_LABELS: Record<number, string> = {
  0: 'Discovery Ads',
  1: 'Keyword Ads',
  2: 'Shop Ads',
  3: 'Boost Ads',
};

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
  ongoing: 'success',
  paused: 'warning',
  ended: 'destructive',
  budget_exceeded: 'warning',
};

export function AdsCampaignPanel({ shopId }: AdsCampaignPanelProps) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdsCampaigns(shopId);
      const campaignList = data?.campaign_brief_list || data?.response?.campaign_brief_list || [];
      setCampaigns(campaignList);
    } catch (err) {
      const msg = (err as Error).message;
      // Check if it's an auth error (shop not connected to Ads app)
      if (msg.includes('kết nối') || msg.includes('authorize') || msg.includes('not found')) {
        setError('Shop chưa kết nối với app Ads. Vui lòng ủy quyền trong phần Quản lý Shop.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'ongoing' ? 'paused' : 'ongoing';
    setTogglingId(campaign.campaign_id);
    try {
      await updateAdsCampaignStatus(shopId, campaign.campaign_id, newStatus);
      setCampaigns(prev => prev.map(c =>
        c.campaign_id === campaign.campaign_id ? { ...c, status: newStatus } : c
      ));
      toast({
        title: 'Thành công',
        description: `Campaign "${campaign.campaign_name}" đã ${newStatus === 'ongoing' ? 'bật' : 'tắt'}`,
      });
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const formatBudget = (amount: number) => {
    if (!amount || amount <= 0) return '-';
    // Shopee returns budget in cents
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount / 100000);
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleDateString('vi-VN');
  };

  const columns = [
    {
      key: 'name',
      header: 'Tên chiến dịch',
      width: '250px',
      mobileHeader: true,
      render: (c: Campaign) => (
        <div>
          <CellText>{c.campaign_name || `Campaign ${c.campaign_id}`}</CellText>
          <CellText muted className="text-xs">
            {CAMPAIGN_TYPE_LABELS[c.campaign_type] || `Type ${c.campaign_type}`}
          </CellText>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      mobileBadge: true,
      render: (c: Campaign) => (
        <CellBadge variant={STATUS_VARIANTS[c.status] || 'default'}>
          {c.status}
        </CellBadge>
      ),
    },
    {
      key: 'budget',
      header: 'Ngân sách/ngày',
      render: (c: Campaign) => (
        <CellText muted>{formatBudget(c.daily_budget)}</CellText>
      ),
    },
    {
      key: 'period',
      header: 'Thời gian',
      render: (c: Campaign) => (
        <CellText muted>
          {formatTimestamp(c.start_time)} - {formatTimestamp(c.end_time)}
        </CellText>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c: Campaign) => {
        if (c.status === 'ended') return null;
        return (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs cursor-pointer"
            onClick={() => handleToggleStatus(c)}
            disabled={togglingId === c.campaign_id}
          >
            {togglingId === c.campaign_id ? (
              <Spinner size="sm" />
            ) : (
              c.status === 'ongoing' ? 'Tắt' : 'Bật'
            )}
          </Button>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          <span className="text-base">Chiến dịch ({campaigns.length})</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCampaigns}
            disabled={loading}
            className="cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={campaigns}
            keyExtractor={(c) => c.campaign_id.toString()}
            emptyMessage="Chưa có chiến dịch quảng cáo nào"
            emptyDescription="Tạo chiến dịch mới trên Shopee Seller Center"
          />
        )}
      </CardContent>
    </Card>
  );
}
