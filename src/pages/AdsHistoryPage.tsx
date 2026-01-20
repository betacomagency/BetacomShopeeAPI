/**
 * AdsHistoryPage - Trang lịch sử thực thi quảng cáo
 */

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, History, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useShopeeAuth } from '@/contexts/ShopeeAuthContext';
import { type AdsBudgetLog } from '@/lib/shopee/ads';
import { cn } from '@/lib/utils';

export default function AdsHistoryPage() {
  const { toast } = useToast();
  const { token } = useShopeeAuth();
  const shopId = token?.shop_id;

  const [logs, setLogs] = useState<AdsBudgetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState('');

  // Filtered data
  const filteredLogs = useMemo(() => {
    if (!logFilter.trim()) return logs;
    const search = logFilter.toLowerCase();
    return logs.filter(l =>
      l.campaign_name?.toLowerCase().includes(search) ||
      l.campaign_id.toString().includes(search)
    );
  }, [logs, logFilter]);

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    if (shopId) {
      loadData();
    }
  }, [shopId]);

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apishopee_ads_budget_logs')
        .select('*')
        .eq('shop_id', shopId)
        .order('executed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data || []) as AdsBudgetLog[]);
    } catch (e) {
      toast({ title: 'Lỗi', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!shopId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Vui lòng chọn shop để xem lịch sử thực thi</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col p-2 md:p-0">
      <Card className="flex flex-col flex-1 min-h-0">
        <div className="border-b px-3 md:px-4 py-2 md:py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-sm md:text-base text-gray-700">Lịch sử thực thi ({filteredLogs.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="ID/Tên chiến dịch"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="h-7 w-full md:w-40 pl-7 text-xs"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        <CardContent className="p-2 md:p-4 flex-1 min-h-0 overflow-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 md:py-12 bg-gray-50 rounded-lg border border-dashed">
              <History className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 md:mb-3 text-gray-300" />
              <p className="text-sm md:text-base text-gray-500 font-medium">{logFilter ? 'Không tìm thấy kết quả' : 'Chưa có lịch sử thực thi'}</p>
              <p className="text-xs md:text-sm text-gray-400 mt-1">{logFilter ? 'Thử tìm kiếm với từ khóa khác' : 'Cron job chạy mỗi 30 phút (phút 0 và 30)'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              {/* Desktop Header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_80px_120px] gap-2 px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase">
                <div>Chiến dịch</div>
                <div className="text-right">Ngân sách</div>
                <div className="text-center">Trạng thái</div>
                <div>Thời gian</div>
              </div>
              {/* Mobile Header */}
              <div className="md:hidden grid grid-cols-[1fr_55px_35px] gap-1 px-2 py-1.5 bg-gray-50 border-b text-[10px] font-medium text-gray-500 uppercase">
                <div>Chiến dịch</div>
                <div className="text-right">Budget</div>
                <div className="text-center">TT</div>
              </div>
              <div className="divide-y">
                {filteredLogs.map(l => {
                  const isExpanded = expandedLogId === l.id;
                  const hasFailed = l.status === 'failed';

                  return (
                    <div key={l.id}>
                      {/* Desktop Row */}
                      <div
                        className={cn(
                          "hidden md:grid grid-cols-[1fr_80px_80px_120px] gap-2 px-3 py-2 items-center transition-colors",
                          hasFailed ? "hover:bg-red-50 cursor-pointer" : "hover:bg-gray-50",
                          isExpanded && hasFailed && "bg-red-50"
                        )}
                        onClick={() => hasFailed && setExpandedLogId(isExpanded ? null : l.id)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm truncate font-medium">{l.campaign_name || 'Campaign ' + l.campaign_id}</p>
                            {hasFailed && (
                              <svg
                                className={cn("w-3 h-3 text-red-500 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">ID: {l.campaign_id}</p>
                        </div>
                        <div className="text-sm text-right font-medium text-orange-600">
                          {formatPrice(l.new_budget)}
                        </div>
                        <div className="text-center">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5",
                            l.status === 'success' ? 'bg-green-100 text-green-700' :
                            l.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {l.status === 'success' ? (
                              <>
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Thành công
                              </>
                            ) : l.status === 'failed' ? (
                              <>
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Thất bại
                              </>
                            ) : (
                              'Bỏ qua'
                            )}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(l.executed_at)}
                        </div>
                      </div>

                      {/* Mobile Row (Table format) */}
                      <div
                        className={cn(
                          "md:hidden grid grid-cols-[1fr_55px_35px] gap-1 px-2 py-2 items-start transition-colors",
                          hasFailed ? "hover:bg-red-50 cursor-pointer" : "hover:bg-gray-50",
                          isExpanded && hasFailed && "bg-red-50"
                        )}
                        onClick={() => hasFailed && setExpandedLogId(isExpanded ? null : l.id)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-start gap-1">
                            <p className="text-[11px] font-medium leading-tight">{l.campaign_name || 'Campaign ' + l.campaign_id}</p>
                            {hasFailed && (
                              <svg
                                className={cn("w-3 h-3 text-red-500 transition-transform flex-shrink-0 mt-0.5", isExpanded && "rotate-180")}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                          <p className="text-[9px] text-gray-400 mt-0.5">{formatDateTime(l.executed_at)}</p>
                        </div>
                        <div className="text-[10px] text-right font-medium text-orange-600">
                          {formatPrice(l.new_budget)}
                        </div>
                        <div className="text-center">
                          <span className={cn(
                            "text-[9px] px-1 py-0.5 rounded-full font-medium",
                            l.status === 'success' ? 'bg-green-100 text-green-700' :
                            l.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {l.status === 'success' ? 'OK' : l.status === 'failed' ? 'Lỗi' : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết lỗi khi expand */}
                      {isExpanded && hasFailed && l.error_message && (
                        <div className="px-3 py-2 bg-red-50 border-t border-red-100">
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-red-700 mb-1">Chi tiết lỗi:</p>
                              <p className="text-xs text-red-600 bg-red-100 p-2 rounded font-mono break-all">
                                {l.error_message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
