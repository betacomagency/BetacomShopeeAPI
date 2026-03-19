/**
 * Ads Performance Panel - Báo cáo hiệu suất quảng cáo Shopee Ads
 * Hiển thị metrics: impressions, clicks, CTR, spend
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimpleDataTable, CellText } from '@/components/ui/data-table';
import { getAdsCampaignPerformance } from '@/lib/shopee/ads-client';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface DailyPerformance {
  date: string;
  campaign_id: number;
  campaign_name?: string;
  impression: number;
  clicks: number;
  ctr: number;
  expense: number; // in cents
  broad_order_amount: number;
}

interface AdsPerformancePanelProps {
  shopId: number;
}

type DateRange = '7d' | '14d' | '30d';

export function AdsPerformancePanel({ shopId }: AdsPerformancePanelProps) {
  const [data, setData] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const getDateRangeTimestamps = (range: DateRange) => {
    const now = Math.floor(Date.now() / 1000);
    const days = range === '7d' ? 7 : range === '14d' ? 14 : 30;
    return {
      start: now - days * 86400,
      end: now,
    };
  };

  const loadPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRangeTimestamps(dateRange);
      const result = await getAdsCampaignPerformance(shopId, start, end);
      const entries = result?.daily_performance_list || result?.response?.daily_performance_list || [];
      setData(entries);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('kết nối') || msg.includes('authorize')) {
        setError('Shop chưa kết nối với app Ads.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [shopId, dateRange]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  // Summary metrics
  const totals = data.reduce(
    (acc, d) => ({
      impressions: acc.impressions + (d.impression || 0),
      clicks: acc.clicks + (d.clicks || 0),
      expense: acc.expense + (d.expense || 0),
      orders: acc.orders + (d.broad_order_amount || 0),
    }),
    { impressions: 0, clicks: 0, expense: 0, orders: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount / 100000);
  };

  const columns = [
    {
      key: 'date',
      header: 'Ngày',
      mobileHeader: true,
      render: (d: DailyPerformance) => (
        <CellText>{d.date}</CellText>
      ),
    },
    {
      key: 'impression',
      header: 'Lượt hiển thị',
      render: (d: DailyPerformance) => (
        <CellText>{(d.impression || 0).toLocaleString('vi-VN')}</CellText>
      ),
    },
    {
      key: 'clicks',
      header: 'Clicks',
      render: (d: DailyPerformance) => (
        <CellText>{(d.clicks || 0).toLocaleString('vi-VN')}</CellText>
      ),
    },
    {
      key: 'ctr',
      header: 'CTR',
      render: (d: DailyPerformance) => (
        <CellText muted>{d.impression > 0 ? ((d.clicks / d.impression) * 100).toFixed(2) : '0.00'}%</CellText>
      ),
    },
    {
      key: 'expense',
      header: 'Chi phí',
      render: (d: DailyPerformance) => (
        <CellText muted>{formatCurrency(d.expense || 0)}</CellText>
      ),
    },
    {
      key: 'orders',
      header: 'Đơn hàng',
      render: (d: DailyPerformance) => (
        <CellText>{(d.broad_order_amount || 0).toLocaleString('vi-VN')}</CellText>
      ),
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
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Summary Cards */}
      {!loading && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Lượt hiển thị', value: totals.impressions.toLocaleString('vi-VN') },
            { label: 'Clicks', value: totals.clicks.toLocaleString('vi-VN') },
            { label: 'CTR', value: `${ctr.toFixed(2)}%` },
            { label: 'Chi phí', value: formatCurrency(totals.expense) },
            { label: 'Đơn hàng', value: totals.orders.toLocaleString('vi-VN') },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold mt-1">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Daily Performance Table */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">Chi tiết theo ngày</span>
              <div className="flex items-center gap-1 ml-2">
                {(['7d', '14d', '30d'] as DateRange[]).map(range => (
                  <Button
                    key={range}
                    variant={dateRange === range ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs cursor-pointer"
                    onClick={() => setDateRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPerformance}
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
              data={data}
              keyExtractor={(d) => `${d.date}-${d.campaign_id}`}
              emptyMessage="Chưa có dữ liệu hiệu suất"
              emptyDescription="Dữ liệu sẽ hiển thị khi có chiến dịch đang chạy"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
