/**
 * Shopee IP Ranges Card - Hiển thị danh sách IP ranges của Shopee
 * Dùng để whitelist firewall và xác minh webhook requests
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Search,
  Shield,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Download,
} from 'lucide-react';

interface IpRangeEntry {
  ip_range: string;
  is_active: boolean;
  fetched_at: string;
  created_at: string;
}

interface PartnerApp {
  id: string;
  partner_id: number;
  partner_name: string;
  app_category: string;
}

interface FetchMeta {
  fetched_at: string | null;
  count: number;
  partner_app_id: string | null;
  partner_name: string | null;
  request_id: string | null;
}

const PER_PAGE = 20;

export function ShopeeIpRangesCard() {
  const [ipRanges, setIpRanges] = useState<IpRangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState<FetchMeta | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [partnerApps, setPartnerApps] = useState<PartnerApp[]>([]);
  const [selectedPartnerAppId, setSelectedPartnerAppId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'cidr' | 'single'>('all');

  // Load IP ranges from DB on mount
  useEffect(() => {
    loadIpRanges();
    loadPartnerApps();
  }, []);

  const loadIpRanges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-ip-ranges', {
        body: { action: 'get' },
      });

      if (error) throw error;

      setIpRanges(data?.ip_ranges || []);
      setLastFetch(data?.last_fetch || null);
      setLastFetchAt(data?.last_fetch_at || null);
    } catch (err) {
      console.error('Error loading IP ranges:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPartnerApps = async () => {
    const { data } = await supabase
      .from('apishopee_partner_apps')
      .select('id, partner_id, partner_name, app_category')
      .eq('is_active', true)
      .order('partner_name');

    if (data && data.length > 0) {
      setPartnerApps(data);
      setSelectedPartnerAppId(data[0].id);
    }
  };

  const handleFetchFromShopee = async () => {
    if (!selectedPartnerAppId) return;
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-ip-ranges', {
        body: { action: 'fetch', partner_app_id: selectedPartnerAppId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reload from DB
      await loadIpRanges();
    } catch (err) {
      console.error('Error fetching IP ranges:', err);
    } finally {
      setFetching(false);
    }
  };

  // Classify IP: CIDR range vs single IP
  const isCidr = (ip: string) => ip.includes('/');

  // Filter and search
  const filteredIps = useMemo(() => {
    let result = ipRanges;

    if (filterType === 'cidr') {
      result = result.filter(r => isCidr(r.ip_range));
    } else if (filterType === 'single') {
      result = result.filter(r => !isCidr(r.ip_range));
    }

    if (searchQuery.trim()) {
      result = result.filter(r => r.ip_range.includes(searchQuery.trim()));
    }

    return result;
  }, [ipRanges, filterType, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredIps.length / PER_PAGE);
  const paginatedIps = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredIps.slice(start, start + PER_PAGE);
  }, [filteredIps, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  // Copy all IPs
  const handleCopyAll = async () => {
    const text = filteredIps.map(r => r.ip_range).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as text file
  const handleExport = () => {
    const text = ipRanges.map(r => r.ip_range).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopee-ip-ranges-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cidrCount = ipRanges.filter(r => isCidr(r.ip_range)).length;
  const singleCount = ipRanges.filter(r => !isCidr(r.ip_range)).length;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-800">Shopee IP Ranges</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Shopee IP Ranges</h3>
            <p className="text-xs text-slate-500">
              {ipRanges.length > 0
                ? `${ipRanges.length} IP (${cidrCount} CIDR, ${singleCount} IP)`
                : 'Chưa có dữ liệu'}
              {lastFetchAt && (
                <span className="ml-2 text-slate-400">
                  - Cập nhật: {formatDateTime(lastFetchAt)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ipRanges.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="h-8 text-xs"
                title="Copy tất cả IP"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 text-xs"
                title="Tải xuống file .txt"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Fetch controls */}
      <div className="flex items-end gap-3 p-4 bg-slate-50/50 border-b">
        <div className="flex-1 max-w-xs space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Partner App</label>
          <Select value={selectedPartnerAppId} onValueChange={setSelectedPartnerAppId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Chọn partner app" />
            </SelectTrigger>
            <SelectContent>
              {partnerApps.map((app) => (
                <SelectItem key={app.id} value={app.id}>
                  {app.partner_name} ({app.app_category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleFetchFromShopee}
          disabled={!selectedPartnerAppId || fetching}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 h-8"
        >
          {fetching ? (
            <>
              <Spinner size="sm" className="mr-1.5" />
              Đang lấy...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Cập nhật từ Shopee
            </>
          )}
        </Button>
      </div>

      {/* Search & Filter */}
      {ipRanges.length > 0 && (
        <div className="flex items-center gap-2 p-4 border-b">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Tìm IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                filterType === 'all'
                  ? 'bg-slate-200 text-slate-800 font-medium'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Tất cả ({ipRanges.length})
            </button>
            <button
              onClick={() => setFilterType('cidr')}
              className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                filterType === 'cidr'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              CIDR ({cidrCount})
            </button>
            <button
              onClick={() => setFilterType('single')}
              className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                filterType === 'single'
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              IP đơn ({singleCount})
            </button>
          </div>
        </div>
      )}

      {/* IP List */}
      {ipRanges.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Globe className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-slate-500">Chưa có dữ liệu IP ranges</p>
          <p className="text-xs text-slate-400">Nhấn "Cập nhật từ Shopee" để lấy danh sách IP</p>
        </div>
      ) : (
        <>
          <ScrollArea className="max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 w-10">#</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">IP / CIDR</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 w-20">Loại</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 w-44">Thời gian lấy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedIps.map((entry, index) => {
                  const isRange = isCidr(entry.ip_range);
                  const rowNum = (currentPage - 1) * PER_PAGE + index + 1;
                  return (
                    <tr key={entry.ip_range} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-400 text-xs">{rowNum}</td>
                      <td className="px-4 py-2">
                        <code className="text-sm font-mono text-slate-800">{entry.ip_range}</code>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                          isRange ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {isRange ? 'CIDR' : 'IP'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {formatDateTime(entry.fetched_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t bg-slate-50/50">
              <span className="text-xs text-slate-500">
                {(currentPage - 1) * PER_PAGE + 1}-{Math.min(currentPage * PER_PAGE, filteredIps.length)} / {filteredIps.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`h-7 w-7 p-0 text-xs ${currentPage === page ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Metadata */}
      {lastFetch && (
        <div className="px-4 py-3 border-t bg-slate-50/30 text-xs text-slate-400 space-y-0.5">
          <p>Partner: {lastFetch.partner_name || '-'} | Request ID: <span className="font-mono">{lastFetch.request_id || '-'}</span></p>
          <p>API: GET /api/v2/public/get_shopee_ip_ranges (partner-level, không cần shop_id)</p>
        </div>
      )}
    </div>
  );
}
