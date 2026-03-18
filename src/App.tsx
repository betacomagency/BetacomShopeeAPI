import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ShopeeAuthProvider } from '@/contexts/ShopeeAuthContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
// Layout
import MainLayout from '@/components/layout/MainLayout';
import AdminLayout from '@/components/layout/AdminLayout';

// Pages
import AuthPage from '@/pages/AuthPage';
import AuthCallback from '@/pages/AuthCallback';
import HomePage from '@/pages/HomePage';
import NotFoundPage from '@/pages/NotFoundPage';

// Settings Pages
import ProfileSettingsPage from '@/pages/settings/ProfileSettingsPage';
import ShopsSettingsPage from '@/pages/settings/ShopsSettingsPage';
import UsersSettingsPage from '@/pages/settings/UsersSettingsPage';
import ApiCallLogsPage from '@/pages/settings/ApiCallLogsPage';

import ShopInfoPage from '@/pages/settings/ShopInfoPage';

// Feature Pages
import FlashSalePage from '@/pages/FlashSalePage';
import FlashSaleDetailPage from '@/pages/FlashSaleDetailPage';
import FlashSaleAutoSetupPage from '@/pages/FlashSaleAutoSetupPage';
import FlashSaleCopyPage from '@/pages/FlashSaleCopyPage';
import FlashSaleOverviewPage from '@/pages/FlashSaleOverviewPage';
import ProductsPage from '@/pages/ProductsPage';
import AdsPage from '@/pages/AdsPage';
import DocsPage from '@/pages/DocsPage';

// Admin Pages
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';

// Shop Performance Page
import ShopPerformancePage from '@/pages/ShopPerformancePage';

// Demo Pages
import TableDemoPage from '@/pages/TableDemoPage';

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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <PermissionsProvider>
            <ShopeeAuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
            <BrowserRouter>
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
                  <Route path="/ads" element={<AdsPage />} />
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
                </Route>

                {/* Backwards compat redirects */}
                <Route path="/settings/api-logs" element={<Navigate to="/admin/api-logs" replace />} />
                <Route path="/settings/shops" element={<Navigate to="/admin/shops" replace />} />
                <Route path="/settings/users" element={<Navigate to="/admin/users" replace />} />
                <Route path="/flash-sale/overview" element={<Navigate to="/admin/flash-sale" replace />} />

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </BrowserRouter>
              </TooltipProvider>
            </ShopeeAuthProvider>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
