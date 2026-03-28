import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ShopeeAuthProvider } from '@/contexts/ShopeeAuthContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Spinner } from '@/components/ui/spinner';
// Layout
import MainLayout from '@/components/layout/MainLayout';
import AdminLayout from '@/components/layout/AdminLayout';

// Pages - Eager load (auth flow, cần hiển thị ngay)
import AuthPage from '@/pages/AuthPage';
import AuthCallback from '@/pages/AuthCallback';

// Pages - Lazy load (tải khi cần, giảm bundle ban đầu)
const HomePage = lazy(() => import('@/pages/HomePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Settings Pages
const ProfileSettingsPage = lazy(() => import('@/pages/settings/ProfileSettingsPage'));
const ShopsSettingsPage = lazy(() => import('@/pages/settings/ShopsSettingsPage'));
const UsersSettingsPage = lazy(() => import('@/pages/settings/UsersSettingsPage'));
const ApiCallLogsPage = lazy(() => import('@/pages/settings/ApiCallLogsPage'));
const ShopInfoPage = lazy(() => import('@/pages/settings/ShopInfoPage'));

// Feature Pages
const FlashSalePage = lazy(() => import('@/pages/FlashSalePage'));
const FlashSaleDetailPage = lazy(() => import('@/pages/FlashSaleDetailPage'));
const FlashSaleAutoSetupPage = lazy(() => import('@/pages/FlashSaleAutoSetupPage'));
const FlashSaleCopyPage = lazy(() => import('@/pages/FlashSaleCopyPage'));
const FlashSaleOverviewPage = lazy(() => import('@/pages/FlashSaleOverviewPage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const DocsPage = lazy(() => import('@/pages/DocsPage'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const MonitoringPage = lazy(() => import('@/pages/admin/monitoring-page'));

// Shop Performance Page
const ShopPerformancePage = lazy(() => import('@/pages/ShopPerformancePage'));

// Demo Pages
const TableDemoPage = lazy(() => import('@/pages/TableDemoPage'));

/** Fallback spinner hiển thị khi lazy component đang tải */
const PageFallback = () => <Spinner className="mt-20" />;

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1 * 60 * 1000, // 1 minute - data considered fresh (reduced from 5 minutes)
            gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
            refetchOnWindowFocus: false, // Don't refetch when tab becomes active
            refetchOnMount: true, // Always refetch on mount to ensure fresh data when switching pages
            retry: 1, // Only retry once on failure
          },
        },
      })
  );

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <PermissionsProvider>
            <ShopeeAuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                {/* Standalone pages (no sidebar) */}
                <Route path="/docs" element={<DocsPage />} />

                {/* Protected routes with MainLayout (user pages) */}
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<HomePage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/flash-sale" element={<FlashSalePage />} />
                  <Route path="/flash-sale/detail/:flashSaleId" element={<FlashSaleDetailPage />} />
                  <Route path="/flash-sale/auto-setup" element={<FlashSaleAutoSetupPage />} />
                  <Route path="/flash-sale/copy/:flashSaleId" element={<FlashSaleCopyPage />} />
                  <Route path="/shop-performance" element={<ShopPerformancePage />} />
                  <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
                  <Route path="/settings/profile" element={<ProfileSettingsPage />} />
                  <Route path="/demo/tables" element={<TableDemoPage />} />
                </Route>

                {/* Admin Panel with AdminLayout */}
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/flash-sale" element={<FlashSaleOverviewPage />} />
                  <Route path="/admin/api-logs" element={<ApiCallLogsPage />} />
                  <Route path="/admin/shops" element={<ShopsSettingsPage />} />
                  <Route path="/admin/shops/:shopId" element={<ShopInfoPage />} />
                  <Route path="/admin/users" element={<UsersSettingsPage />} />
                  <Route path="/admin/monitoring" element={<MonitoringPage />} />
                  <Route path="/admin/monitoring/:tab" element={<MonitoringPage />} />
                </Route>

                {/* Backwards compat redirects */}
                <Route path="/settings/api-logs" element={<Navigate to="/admin/api-logs" replace />} />
                <Route path="/settings/shops" element={<Navigate to="/admin/shops" replace />} />
                <Route path="/settings/users" element={<Navigate to="/admin/users" replace />} />
                <Route path="/flash-sale/overview" element={<Navigate to="/admin/flash-sale" replace />} />

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
              </BrowserRouter>
              </TooltipProvider>
            </ShopeeAuthProvider>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
