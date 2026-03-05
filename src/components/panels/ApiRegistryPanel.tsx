/**
 * API Registry Panel - API Statistics giống layout Shopee Open Platform
 * Summary cards + bảng API Name / Success / Fail / Total / Rate
 * Click "Chi tiết" → navigate sang trang detail có bộ lọc
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApiRegistry,
  type ApiRegistryEntry,
  type ApiRegistryFilters,
  type SortField,
} from '@/hooks/useApiRegistry';
import { formatEndpoint } from '@/components/panels/ApiCallLogsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import {
  Layers,
  Search,
  RefreshCw,
  Eye,
  ArrowUpDown,
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'auth', label: 'Auth' },
  { value: 'product', label: 'Product' },
  { value: 'flash_sale', label: 'Flash Sale' },
  { value: 'shop', label: 'Shop' },
  { value: 'order', label: 'Order' },
  { value: 'finance', label: 'Finance' },
  { value: 'review', label: 'Review' },
];

/**
 * Mapping từ REST path → Shopee official API name (cho các API có tên khác path)
 * Key: phần cuối endpoint path (sau /api/), Value: tên Shopee chính thức
 */
const SHOPEE_API_NAME_MAP: Record<string, string> = {
  'v2/auth/access_token/get': 'v2.public.refresh_access_token',
  'v2/auth/token/get': 'v2.public.get_access_token',
};

/** Format API endpoint to Shopee-style: v2.category.action */
export function formatApiName(endpoint: string): string {
  // /api/v2/auth/access_token/get → v2.public.refresh_access_token (via mapping)
  const parts = endpoint.split('/').filter(Boolean);
  const startIdx = parts[0] === 'api' ? 1 : 0;
  const pathKey = parts.slice(startIdx).join('/');

  // Check mapping first
  if (SHOPEE_API_NAME_MAP[pathKey]) {
    return SHOPEE_API_NAME_MAP[pathKey];
  }

  // Default: convert path segments to dot notation
  return parts.slice(startIdx).join('.');
}

// ==================== MAIN PANEL ====================

export function ApiRegistryPanel() {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: today,
    to: today,
  });
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('total_calls');
  const [sortDesc, setSortDesc] = useState(true);
  const navigate = useNavigate();

  const filters: ApiRegistryFilters = {
    category,
    from: dateRange?.from,
    to: dateRange?.to,
  };
  const { data: entries, isLoading, refetch, isFetching } = useApiRegistry(filters);

  const navigateToDetail = useCallback((entry: ApiRegistryEntry) => {
    const params = new URLSearchParams({
      endpoint: entry.api_endpoint,
      method: entry.http_method,
      category: entry.api_category,
      function: entry.edge_function,
      calls: entry.total_calls.toString(),
      rate: entry.success_rate.toString(),
      failed: entry.failed_count.toString(),
      avg_ms: entry.avg_duration.toString(),
    });
    navigate(`/admin/api-registry/detail?${params.toString()}`);
  }, [navigate]);

  // Filter + sort client-side
  const sortedEntries = useMemo(() => {
    if (!entries) return [];
    let filtered = entries;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.api_endpoint.toLowerCase().includes(s) ||
        e.edge_function.toLowerCase().includes(s)
      );
    }

    return [...filtered].sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'total_calls': diff = a.total_calls - b.total_calls; break;
        case 'success_rate': diff = a.success_rate - b.success_rate; break;
        case 'avg_duration': diff = a.avg_duration - b.avg_duration; break;
        case 'last_called_at': diff = new Date(a.last_called_at).getTime() - new Date(b.last_called_at).getTime(); break;
        case 'api_endpoint': diff = a.api_endpoint.localeCompare(b.api_endpoint); break;
      }
      return sortDesc ? -diff : diff;
    });
  }, [entries, search, sortBy, sortDesc]);

  // Summary stats (giống Shopee: Success Rate, Success Calls, Fail Calls, Total Calls)
  const summary = useMemo(() => {
    if (!entries || entries.length === 0) return { successRate: 0, successCalls: 0, failCalls: 0, totalCalls: 0 };
    const totalCalls = entries.reduce((s, e) => s + e.total_calls, 0);
    const successCalls = entries.reduce((s, e) => s + e.success_count, 0);
    const failCalls = entries.reduce((s, e) => s + e.failed_count, 0);
    return {
      successRate: totalCalls > 0 ? Math.round((successCalls / totalCalls) * 1000) / 10 : 0,
      successCalls,
      failCalls,
      totalCalls,
    };
  }, [entries]);

  const handleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      setSortDesc(d => !d);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  }, [sortBy]);

  const fmt = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm API..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">API</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[130px] h-8 text-sm cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="cursor-pointer">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ngày</label>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary Cards - Shopee style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-r border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Success Rate</p>
          {isLoading ? <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" /> : (
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{summary.successRate}%</p>
          )}
        </div>
        <div className="p-4 border-r border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Success Calls</p>
          {isLoading ? <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" /> : (
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(summary.successCalls)}</p>
          )}
        </div>
        <div className="p-4 border-r border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Fail Calls</p>
          {isLoading ? <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" /> : (
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(summary.failCalls)}</p>
          )}
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-1">Total Calls</p>
          {isLoading ? <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" /> : (
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(summary.totalCalls)}</p>
          )}
        </div>
      </div>

      {/* API Table - Shopee style */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Không tìm thấy API nào</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th
                      className="text-left px-4 py-3 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                      onClick={() => handleSort('api_endpoint')}
                    >
                      <span className="flex items-center gap-1">API Name <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                      onClick={() => handleSort('total_calls')}
                    >
                      <span className="flex items-center justify-end gap-1">Success Calls <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                      onClick={() => handleSort('total_calls')}
                    >
                      <span className="flex items-center justify-end gap-1">Fail Calls <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                      onClick={() => handleSort('total_calls')}
                    >
                      <span className="flex items-center justify-end gap-1">Total Calls <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700"
                      onClick={() => handleSort('success_rate')}
                    >
                      <span className="flex items-center justify-end gap-1">Success Rate <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedEntries.map((entry) => (
                    <tr
                      key={`${entry.api_endpoint}::${entry.edge_function}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3" title={entry.api_endpoint}>
                        <span className="text-sm text-slate-700">{formatApiName(entry.api_endpoint)}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">
                        {fmt(entry.success_count)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">
                        <span className={entry.failed_count > 0 ? 'text-red-600 font-medium' : 'text-slate-700'}>
                          {fmt(entry.failed_count)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums font-medium">
                        {fmt(entry.total_calls)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">
                        <span className={entry.success_rate < 95 ? 'text-red-600 font-medium' : 'text-slate-700'}>
                          {entry.success_rate}%
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          onClick={() => navigateToDetail(entry)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {sortedEntries.map((entry) => (
                <div
                  key={`${entry.api_endpoint}::${entry.edge_function}`}
                  className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => navigateToDetail(entry)}
                >
                  <p className="text-sm text-slate-700 mb-1.5">{formatApiName(entry.api_endpoint)}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Success <strong className="text-slate-700">{fmt(entry.success_count)}</strong></span>
                    <span>Fail <strong className={entry.failed_count > 0 ? 'text-red-600' : 'text-slate-700'}>{fmt(entry.failed_count)}</strong></span>
                    <span>Total <strong className="text-slate-700">{fmt(entry.total_calls)}</strong></span>
                    <span className={`ml-auto font-medium ${entry.success_rate < 95 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {entry.success_rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
