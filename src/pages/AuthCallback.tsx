/**
 * Auth Callback - Xử lý OAuth callback từ Shopee
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useAuth } from '@/hooks/useAuth';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback } = useShopeeAuth();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    // Đợi auth load xong trước khi xử lý callback
    if (authLoading) return;
    
    // Tránh xử lý nhiều lần
    if (processedRef.current || isProcessing) return;

    const processCallback = async () => {
      const code = searchParams.get('code');
      const shopId = searchParams.get('shop_id');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Shopee authorization failed: ${errorParam}`);
        return;
      }

      if (!code) {
        setError('Missing authorization code');
        return;
      }

      // Kiểm tra user đã đăng nhập chưa
      if (!isAuthenticated) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      processedRef.current = true;
      setIsProcessing(true);

      try {
        await handleCallback(code, shopId ? Number(shopId) : undefined);
        // Dùng navigate với state để báo cho ShopsSettingsPage reload data
        // Thêm ?refresh param để trigger reload trong ShopManagementPanel
        navigate('/settings/shops?refresh=' + Date.now(), { replace: true });
      } catch (err) {
        processedRef.current = false;
        setError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate, authLoading, isAuthenticated, isProcessing]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Xác thực thất bại</h1>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Quay lại đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Đang xác thực với Shopee...</p>
      </div>
    </div>
  );
}
