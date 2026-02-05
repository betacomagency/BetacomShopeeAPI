/**
 * Analytics Orders Page - Optimized Version
 * Báo cáo đơn hàng với lazy loading và pagination
 *
 * Features:
 * - Lazy loading: Chỉ fetch data khi tab được chọn
 * - Pagination: Cho bảng sản phẩm với nhiều items
 * - Server-side aggregation: Qua Edge Function
 * - Fallback: Client-side processing khi Edge Function unavailable
 */

import { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import {
  useOrderReportsLazy,
  type OrderReportTab,
  type CustomDateRange,
} from '@/hooks/useOrderReportsOptimized';
import type { AnalyticsDateRange } from '@/components/ui/date-range-picker';

import { TABS } from './constants';
import { getDefaultDateRange } from './helpers';
import {
  CreatedOrdersTab,
  CompletedOrdersTab,
  ValueAnalysisTab,
  ProductAnalysisTab,
  StatusAnalysisTab,
  CancelReasonsTab,
} from './tabs';

export default function AnalyticsOrdersPageOptimized() {
  const { user } = useAuth();
  const { selectedShopId } = useShopeeAuth();

  // Filter states
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(getDefaultDateRange);
  const [activeTab, setActiveTab] = useState<OrderReportTab>('created');

  // Convert AnalyticsDateRange to CustomDateRange
  const customDateRange: CustomDateRange | null = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    return { from: dateRange.from, to: dateRange.to };
  }, [dateRange]);

  // Use optimized hook with lazy loading
  const {
    dailyStats,
    dailyCompletedStats,
    valueRanges,
    quantityRanges,
    productItems,
    productTotal,
    productTotalPages,
    dailyStatusStats,
    cancelReasons,
    totals,
    loading,
    productPage,
    setProductPage,
    productSearch,
    setProductSearch,
    productSort,
    setProductSort,
    prefetchTab,
  } = useOrderReportsLazy(
    selectedShopId || 0,
    user?.id || '',
    customDateRange,
    activeTab
  );

  // Handlers
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as OrderReportTab);
      // Prefetch adjacent tabs
      const currentIndex = TABS.findIndex((t) => t.id === tab);
      if (currentIndex > 0) prefetchTab(TABS[currentIndex - 1].id);
      if (currentIndex < TABS.length - 1) prefetchTab(TABS[currentIndex + 1].id);
    },
    [prefetchTab]
  );

  if (!selectedShopId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Vui lòng chọn shop để xem báo cáo</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-slate-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer data-[state=active]:bg-white"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab: Đơn tạo */}
        <TabsContent value="created" className="mt-4">
          <CreatedOrdersTab
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            loading={loading}
            dailyStats={dailyStats}
          />
        </TabsContent>

        {/* Tab: Đơn thành công */}
        <TabsContent value="completed" className="mt-4">
          <CompletedOrdersTab
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            loading={loading}
            dailyCompletedStats={dailyCompletedStats}
          />
        </TabsContent>

        {/* Tab: Theo giá trị đơn hàng */}
        <TabsContent value="value" className="mt-4">
          <ValueAnalysisTab
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            loading={loading}
            valueRanges={valueRanges}
            quantityRanges={quantityRanges}
            totals={totals}
          />
        </TabsContent>

        {/* Tab: Theo sản phẩm - uses viewport height */}
        <TabsContent value="product" className="mt-4">
          <ProductAnalysisTab
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            loading={loading}
            productItems={productItems}
            productTotal={productTotal}
            productTotalPages={productTotalPages}
            productPage={productPage}
            setProductPage={setProductPage}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            productSort={productSort}
            setProductSort={setProductSort}
          />
        </TabsContent>

        {/* Tab: Theo trạng thái */}
        <TabsContent value="status" className="mt-4">
          <StatusAnalysisTab
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            loading={loading}
            dailyStatusStats={dailyStatusStats}
            totals={totals}
          />
        </TabsContent>

        {/* Tab: Lý do khách hủy */}
        <TabsContent value="cancel" className="mt-4">
          <CancelReasonsTab
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            loading={loading}
            cancelReasons={cancelReasons}
            totals={totals}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
