import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { ShopeeAuthProvider } from '@/contexts/ShopeeAuthContext';
// [HIDDEN] Lazada feature - temporarily disabled
// import { LazadaAuthProvider } from '@/contexts/LazadaAuthContext';

// Layout
import MainLayout from '@/components/layout/MainLayout';

// Pages
import AuthPage from '@/pages/AuthPage';
import AuthCallback from '@/pages/AuthCallback';
import HomePage from '@/pages/HomePage';
import NotFoundPage from '@/pages/NotFoundPage';

// Settings Pages
import ProfileSettingsPage from '@/pages/settings/ProfileSettingsPage';
import ShopsSettingsPage from '@/pages/settings/ShopsSettingsPage';
import UsersSettingsPage from '@/pages/settings/UsersSettingsPage';
import AdvancedSettingsPage from '@/pages/settings/AdvancedSettingsPage';

// Feature Pages
import FlashSalePage from '@/pages/FlashSalePage';
import FlashSaleDetailPage from '@/pages/FlashSaleDetailPage';
import FlashSaleAutoSetupPage from '@/pages/FlashSaleAutoSetupPage';
import ProductsPage from '@/pages/ProductsPage';
import AdsPage from '@/pages/AdsPage';
// [HIDDEN] Reviews feature - temporarily disabled
// import ReviewsPage from '@/pages/ReviewsPage';
// import ReviewsAutoReplyPage from '@/pages/ReviewsAutoReplyPage';
// [HIDDEN] API & Logs - temporarily disabled
// import ApiLogsPage from '@/pages/ApiLogsPage';
// [HIDDEN] Lazada Pages - temporarily disabled
// import LazadaDashboardPage from '@/pages/lazada/LazadaDashboardPage';
// import LazadaShopsPage from '@/pages/lazada/LazadaShopsPage';
// import LazadaOrdersPage from '@/pages/lazada/LazadaOrdersPage';
// import LazadaProductsPage from '@/pages/lazada/LazadaProductsPage';
// import LazadaCallbackPage from '@/pages/lazada/LazadaCallbackPage';

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
      <AuthProvider>
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
                {/* [HIDDEN] Lazada callback - temporarily disabled */}
                {/* <Route path="/lazada/callback" element={<LazadaCallbackPage />} /> */}

                {/* Protected routes with MainLayout */}
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<HomePage />} />
                  {/* Feature Routes */}
                  <Route path="/products" element={<ProductsPage />} />
                  {/* [HIDDEN] Reviews feature - temporarily disabled */}
                  {/* <Route path="/reviews" element={<ReviewsPage />} /> */}
                  {/* <Route path="/reviews/auto-reply" element={<ReviewsAutoReplyPage />} /> */}
                  <Route path="/flash-sale" element={<FlashSalePage />} />
                  <Route path="/flash-sale/detail/:flashSaleId" element={<FlashSaleDetailPage />} />

                  <Route path="/flash-sale/auto-setup" element={<FlashSaleAutoSetupPage />} />
                  {/* Ads Routes */}
                  <Route path="/ads" element={<AdsPage />} />
                  {/* [HIDDEN] API & Logs - temporarily disabled */}
                  {/* <Route path="/api-logs" element={<ApiLogsPage />} /> */}

                  {/* Settings Routes */}
                  <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
                  <Route path="/settings/profile" element={<ProfileSettingsPage />} />
                  <Route path="/settings/shops" element={<ShopsSettingsPage />} />
                  <Route path="/settings/users" element={<UsersSettingsPage />} />
                  <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />

                  {/* [HIDDEN] Lazada Routes - temporarily disabled */}
                  {/* <Route path="/lazada" element={<LazadaDashboardPage />} /> */}
                  {/* <Route path="/lazada/shops" element={<LazadaShopsPage />} /> */}
                  {/* <Route path="/lazada/orders" element={<LazadaOrdersPage />} /> */}
                  {/* <Route path="/lazada/products" element={<LazadaProductsPage />} /> */}
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
            </TooltipProvider>
        </ShopeeAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
