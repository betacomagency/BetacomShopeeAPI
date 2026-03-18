/**
 * Shop Management Panel - Quản lý danh sách shop
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { useAuth } from '@/hooks/useAuth';
import { clearToken } from '@/lib/shopee';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { SimpleDataTable, CellShopInfo, CellBadge, CellText, CellActions } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { usePermissionsContext } from '@/contexts/PermissionsContext';
import { ShopAppConnectionStatus, usePartnerApps, type PartnerApp } from '@/components/profile/ShopAppConnectionStatus';

// Số shop mỗi trang
const SHOPS_PER_PAGE = 30;

interface Shop {
  id: string; // UUID - internal ID
  shop_id: number; // Shopee shop ID
  shop_name: string | null;
  shop_logo: string | null;
  region: string | null;
  partner_id: number | null;
  partner_name: string | null;
  created_at: string;
  token_updated_at: string | null;
  expired_at: number | null; // Access token expiry (legacy field)
  access_token_expired_at: number | null; // Access token expiry (4 hours)
  expire_in: number | null; // Access token lifetime in seconds
  expire_time: number | null; // Authorization expiry timestamp from Shopee (1 year)
}

interface ShopWithRole extends Shop {
  role: string;
  memberCount?: number;
}

interface ShopManagementPanelProps {
  readOnly?: boolean; // Chế độ chỉ xem - ẩn các action
}

export function ShopManagementPanel({ readOnly = false }: ShopManagementPanelProps) {
  const { toast } = useToast();
  const { user, login, isLoading: isAuthLoading } = useShopeeAuth();
  const { user: authUser, isLoading: isAuthContextLoading } = useAuth();
  const { isAdmin: isSystemAdmin } = usePermissionsContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<ShopWithRole[]>([]);
  const [refreshingToken, setRefreshingToken] = useState<number | null>(null);
  const [refreshingAllTokens, setRefreshingAllTokens] = useState(false);
  const hasLoadedRef = useRef(false);
  
  // Combined loading state - chờ cả 2 auth sources
  const isAnyAuthLoading = isAuthLoading || isAuthContextLoading;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<ShopWithRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Connect new shop dialog
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [partnerIdInput, setPartnerIdInput] = useState('');
  const [partnerKeyInput, setPartnerKeyInput] = useState('');
  const [partnerNameInput, setPartnerNameInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Connect via registered partner app (multi-app flow)
  const { partnerApps } = usePartnerApps();
  const [connectAppDialogOpen, setConnectAppDialogOpen] = useState(false);
  const [selectedPartnerApp, setSelectedPartnerApp] = useState<PartnerApp | null>(null);
  const [connectingApp, setConnectingApp] = useState(false);



  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Shop search & filter state
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [shopFilterStatus, setShopFilterStatus] = useState<'all' | 'token_ok' | 'token_expired' | 'auth_expired'>('all');
  const loadShops = useCallback(async (userId?: string) => {
    // Sử dụng userId được truyền vào, hoặc fallback về user?.id
    const effectiveUserId = userId || user?.id;
    
    if (!effectiveUserId) {
      return;
    }
    setLoading(true);
    try {
      // Query shop_members với role info và join luôn shops data
      const { data: memberData, error: memberError } = await supabase
        .from('apishopee_shop_members')
        .select(`
          shop_id, 
          role_id, 
          apishopee_roles(name),
          apishopee_shops(id, shop_id, shop_name, shop_logo, region, partner_id, partner_name, created_at, token_updated_at, expired_at, access_token_expired_at, expire_in, expire_time)
        `)
        .eq('profile_id', effectiveUserId)
        .eq('is_active', true);

      if (memberError) {
        throw memberError;
      }

      if (!memberData || memberData.length === 0) {
        setShops([]);
        setLoading(false);
        return;
      }

      // Map data từ join query
      const shopsWithRole: ShopWithRole[] = memberData
        .filter(m => m.apishopee_shops) // Chỉ lấy những member có shop data
        .map(m => {
          // Supabase returns single object for .single() relations
          const shop = m.apishopee_shops as unknown as Shop;
          const roles = m.apishopee_roles as unknown as { name?: string } | null;
          return {
            ...shop,
            role: roles?.name || 'member',
          };
        });

      setShops(shopsWithRole);
      setLoading(false);
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách shop',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [user?.id, toast]);

  // Check for refresh param from OAuth callback
  useEffect(() => {
    const refreshParam = searchParams.get('refresh');
    if (refreshParam) {
      // Clear the param from URL
      searchParams.delete('refresh');
      setSearchParams(searchParams, { replace: true });
      // Reset loaded flag và trigger reload ngay lập tức
      hasLoadedRef.current = false;
      fetchedShopInfoRef.current = new Set();
      // Trigger reload nếu đã có user
      const userId = authUser?.id || user?.id;
      if (userId && !isAnyAuthLoading) {
        loadShops(userId);
        hasLoadedRef.current = true;
      }
    }
  }, [searchParams, setSearchParams, user?.id, authUser?.id, isAnyAuthLoading, loadShops]);

  // Reset hasLoadedRef when component mounts (fixes tab switching issue)
  useEffect(() => {
    hasLoadedRef.current = false;
    fetchedShopInfoRef.current = new Set();
  }, []);

  useEffect(() => {
    // Sử dụng authUser từ useAuth (AuthContext) thay vì user từ useShopeeAuth
    // vì AuthContext đã được init trước và stable hơn
    const userId = authUser?.id || user?.id;
    
    // Chờ auth loading xong mới query
    if (!isAnyAuthLoading && userId) {
      // Only load if not already loaded (unless refresh param was set)
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadShops(userId);
      }
    } else if (!isAnyAuthLoading && !userId) {
      // Auth xong nhưng không có user -> không loading nữa
      setLoading(false);
    }
  }, [user?.id, authUser?.id, isAnyAuthLoading, loadShops]);

  // Fallback: nếu loading quá lâu (> 5s) mà không có data, tự động tắt loading
  useEffect(() => {
    if (!loading) return;
    
    const timeout = setTimeout(() => {
      if (loading && shops.length === 0) {
        setLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [loading, shops.length]);

  // Note: Removed visibilitychange listener as it was causing unnecessary reloads
  // OAuth callback now uses ?refresh param to trigger reload when needed

  // Tự động fetch thông tin shop cho các shop thiếu dữ liệu (shop_name hoặc expire_time)
  // Dữ liệu này được lấy từ Shopee API get_shop_info, không phải từ token API
  const fetchedShopInfoRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchMissingShopInfo = async () => {
      // Tìm các shop thiếu shop_name HOẶC expire_time VÀ chưa được fetch
      const shopsNeedingInfo = shops.filter(
        shop => (!shop.shop_name || !shop.expire_time) && !fetchedShopInfoRef.current.has(shop.shop_id)
      );

      if (shopsNeedingInfo.length === 0) return;

      // Gọi API song song cho tất cả shops cần fetch (không chờ tuần tự)
      const fetchPromises = shopsNeedingInfo.map(async (shop) => {
        // Mark as fetched to prevent duplicate calls
        fetchedShopInfoRef.current.add(shop.shop_id);

        try {
          // Force refresh để lấy dữ liệu mới nhất từ Shopee API
          // vì shop mới tạo có thể chưa có cache
          const { data, error } = await supabase.functions.invoke('shopee-shop', {
            body: { action: 'get-full-info', shop_id: shop.shop_id, force_refresh: true },
          });

          if (error) {
            return null;
          }

          // Kiểm tra API error từ Shopee
          if (data?.debug?.hasInfoError) {
            return null;
          }

          // Lấy data từ response
          const shopNameFromApi = data?.info?.shop_name;
          const shopLogoFromApi = data?.profile?.response?.shop_logo;
          const expireTimeFromApi = data?.info?.expire_time;
          const authTimeFromApi = data?.info?.auth_time;

          // Fetch lại từ DB để kiểm tra xem edge function đã lưu chưa
          const { data: shopData, error: shopError } = await supabase
            .from('apishopee_shops')
            .select('shop_name, shop_logo, expire_time')
            .eq('shop_id', shop.shop_id)
            .single();

          if (shopError) {
            console.error('[SHOPS] ❌ Error fetching shop from DB:', shopError);
          }

          console.log('[SHOPS] DB data for shop', shop.shop_id, ':', shopData);

          // Kiểm tra nếu DB vẫn chưa có data -> edge function không lưu được
          // Frontend sẽ tự lưu trực tiếp
          const dbNeedsUpdate = !shopData?.shop_name && shopNameFromApi;
          
          if (dbNeedsUpdate) {
            console.log('[SHOPS] ⚠️ Edge function did not save data, saving from frontend...');
            
            const updateData: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
            };
            
            if (shopNameFromApi) updateData.shop_name = shopNameFromApi;
            if (shopLogoFromApi) updateData.shop_logo = shopLogoFromApi;
            if (expireTimeFromApi) updateData.expire_time = expireTimeFromApi;
            if (authTimeFromApi) updateData.auth_time = authTimeFromApi;
            
            // Region từ response
            if (data?.info?.region) updateData.region = data.info.region;
            
            const { error: updateError } = await supabase
              .from('apishopee_shops')
              .update(updateData)
              .eq('shop_id', shop.shop_id);

            if (updateError) {
              console.error('[SHOPS] ❌ Frontend save failed:', updateError);
            } else {
              console.log('[SHOPS] ✅ Frontend saved shop info to DB successfully');
            }
          }

          // Ưu tiên dữ liệu từ DB (đã được edge function lưu), fallback về response trực tiếp
          const shopName = shopData?.shop_name || shopNameFromApi;
          const shopLogo = shopData?.shop_logo || shopLogoFromApi;
          const expireTime = shopData?.expire_time || expireTimeFromApi;

          console.log('[SHOPS] ✅ Final info for shop', shop.shop_id, ':', { shopName, expireTime });

          return { 
            shop_id: shop.shop_id, 
            shop_name: shopName,
            shop_logo: shopLogo,
            expire_time: expireTime,
          };
        } catch (err) {
          console.error('[SHOPS] ❌ Error fetching info for shop', shop.shop_id, err);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      
      // Batch update state một lần với tất cả thông tin đã fetch được
      const updates = results.filter(r => r && (r.shop_name || r.expire_time));
      if (updates.length > 0) {
        console.log('[SHOPS] Updating', updates.length, 'shops with new info');
        setShops(prev => prev.map(s => {
          const update = updates.find(u => u?.shop_id === s.shop_id);
          if (!update) return s;
          return { 
            ...s, 
            shop_name: update.shop_name || s.shop_name,
            shop_logo: update.shop_logo || s.shop_logo,
            expire_time: update.expire_time || s.expire_time,
          };
        }));
      }
    };

    // Chỉ chạy khi đã có shops và không đang loading
    if (shops.length > 0 && !loading) {
      fetchMissingShopInfo();
    }
  }, [shops, loading]); // Chạy khi shops thay đổi hoặc loading xong

  // Refresh token cho shop bằng edge function
  const handleRefreshToken = async (shop: ShopWithRole) => {
    setRefreshingToken(shop.shop_id);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-token-refresh', {
        body: { shop_id: shop.shop_id },
      });

      if (error) throw error;

      if (data?.success && data?.results?.[0]?.status === 'success') {
        // Cập nhật shop trong state với thời gian hết hạn mới
        const result = data.results[0];
        const newExpiry = result.new_expiry ? new Date(result.new_expiry).getTime() : null;
        
        setShops(prev => prev.map(s =>
          s.shop_id === shop.shop_id ? {
            ...s,
            expired_at: newExpiry,
            access_token_expired_at: newExpiry,
            token_updated_at: new Date().toISOString(),
          } : s
        ));

        toast({
          title: 'Thành công',
          description: `Đã refresh token cho ${shop.shop_name || shop.shop_id}`,
        });
      } else {
        const errorMsg = data?.results?.[0]?.error || data?.error || 'Không thể refresh token';
        throw new Error(errorMsg);
      }
    } catch (err) {
      toast({
        title: 'Lỗi refresh token',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRefreshingToken(null);
    }
  };

  // Refresh token cho tất cả shops
  const handleRefreshAllTokens = async () => {
    setRefreshingAllTokens(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-token-refresh', {
        body: {}, // Không truyền shop_id để refresh tất cả
      });

      if (error) throw error;

      if (data?.success) {
        // Cập nhật tất cả shops thành công
        const successResults = (data.results || []).filter((r: { status: string }) => r.status === 'success');
        
        if (successResults.length > 0) {
          setShops(prev => prev.map(s => {
            const result = successResults.find((r: { shop_id: number }) => r.shop_id === s.shop_id);
            if (result?.new_expiry) {
              const newExpiry = new Date(result.new_expiry).getTime();
              return {
                ...s,
                expired_at: newExpiry,
                access_token_expired_at: newExpiry,
                token_updated_at: new Date().toISOString(),
              };
            }
            return s;
          }));
        }

        toast({
          title: 'Hoàn tất',
          description: `${data.success_count || 0} thành công, ${data.failed_count || 0} thất bại`,
        });
      } else {
        throw new Error(data?.error || 'Không thể refresh tokens');
      }
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRefreshingAllTokens(false);
    }
  };

  const handleDeleteShop = async () => {
    if (!shopToDelete) return;

    setDeleting(true);
    try {
      // Delete dependent records first, then the shop
      // 1. Delete shop members
      await supabase
        .from('apishopee_shop_members')
        .delete()
        .eq('shop_id', shopToDelete.id);

      // 2. Delete token refresh logs
      await supabase
        .from('apishopee_token_refresh_logs')
        .delete()
        .eq('shop_id', shopToDelete.id);

      // 3. Delete app-specific tokens (multi-partner)
      await supabase
        .from('apishopee_shop_app_tokens')
        .delete()
        .eq('shop_id', shopToDelete.shop_id);

      // 4. Delete the shop (cascade also handles remaining refs)
      const { error: shopError } = await supabase
        .from('apishopee_shops')
        .delete()
        .eq('id', shopToDelete.id);

      if (shopError) throw shopError;

      // Clear localStorage token if deleted shop was the selected one
      await clearToken();

      setShops(prev => prev.filter(s => s.id !== shopToDelete.id));
      setDeleteDialogOpen(false);
      setShopToDelete(null);

      toast({ title: 'Thành công', description: 'Đã xóa shop' });

      // Reload page to refresh all states
      window.location.reload();
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleConnectNewShop = async () => {
    // Reset state và mở dialog
    setPartnerIdInput('');
    setPartnerKeyInput('');
    setPartnerNameInput('');
    setConnectDialogOpen(true);
  };

  const handleSubmitConnect = async () => {
    if (!partnerIdInput || !partnerKeyInput) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập Partner ID và Partner Key',
        variant: 'destructive',
      });
      return;
    }

    setConnecting(true);
    try {
      const partnerInfo = {
        partner_id: Number(partnerIdInput),
        partner_key: partnerKeyInput,
        partner_name: partnerNameInput || undefined,
      };

      await login(undefined, undefined, partnerInfo);
      // Dialog sẽ tự đóng khi redirect
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  // Connect shop via registered partner app (multi-app flow)
  const handleConnectApp = async (partnerApp: PartnerApp) => {
    setSelectedPartnerApp(partnerApp);
    setConnectAppDialogOpen(true);
  };

  const handleSubmitConnectApp = async () => {
    if (!selectedPartnerApp) return;
    setConnectingApp(true);
    try {
      // Build callback URL (same as DEFAULT_CALLBACK in ShopeeAuthContext)
      const callbackUrl = import.meta.env.VITE_SHOPEE_CALLBACK_URL
        || `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.functions.invoke('apishopee-auth', {
        body: {
          action: 'get-app-auth-url',
          partner_app_id: selectedPartnerApp.id,
          redirect_uri: callbackUrl,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Store partner_app_id in sessionStorage for callback handling
      sessionStorage.setItem('shopee_partner_app_id', selectedPartnerApp.id);
      sessionStorage.setItem('shopee_app_category', selectedPartnerApp.app_category);

      // Redirect to Shopee OAuth
      const authUrl = data?.auth_url || data?.url || data?.authUrl;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error('Không nhận được URL ủy quyền');
      }
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: (err as Error).message,
        variant: 'destructive',
      });
      setConnectingApp(false);
    }
  };

  /**
   * Tính thời gian hết hạn ủy quyền (authorization expiry)
   * Sử dụng expire_time từ Shopee API (timestamp giây)
   */
  const getAuthorizationExpiry = (shop: ShopWithRole): number | null => {
    // Nếu có expire_time từ Shopee API (timestamp giây), dùng nó
    if (shop.expire_time) {
      return shop.expire_time * 1000; // Convert to milliseconds
    }

    // Không có expire_time - hiển thị "-"
    return null;
  };

  const formatDate = (timestamp: number | string | null) => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTokenStatus = (shop: ShopWithRole): { label: string; variant: 'success' | 'warning' | 'destructive' } => {
    // Ưu tiên dùng expired_at (được cập nhật khi refresh token)
    // Fallback: tính từ token_updated_at + expire_in
    let accessTokenExpiry = shop.expired_at;
    if (!accessTokenExpiry && shop.token_updated_at && shop.expire_in) {
      accessTokenExpiry = new Date(shop.token_updated_at).getTime() + (shop.expire_in * 1000);
    }

    if (!accessTokenExpiry) return { label: 'Chưa xác định', variant: 'warning' };

    const now = Date.now();
    const timeLeft = accessTokenExpiry - now;

    if (timeLeft <= 0) {
      return { label: 'Hết hạn', variant: 'destructive' };
    } else {
      // Format as HH:MM DD-MM
      const expireDate = new Date(accessTokenExpiry);
      const hours = expireDate.getHours().toString().padStart(2, '0');
      const minutes = expireDate.getMinutes().toString().padStart(2, '0');
      const day = expireDate.getDate().toString().padStart(2, '0');
      const month = (expireDate.getMonth() + 1).toString().padStart(2, '0');
      return { label: `${hours}:${minutes} ${day}-${month}`, variant: 'success' };
    }
  };

  // Helper: check if shop's access token is expired
  const isTokenExpired = useCallback((shop: ShopWithRole): boolean => {
    let accessTokenExpiry = shop.expired_at;
    if (!accessTokenExpiry && shop.token_updated_at && shop.expire_in) {
      accessTokenExpiry = new Date(shop.token_updated_at).getTime() + (shop.expire_in * 1000);
    }
    if (!accessTokenExpiry) return true; // unknown = treat as expired
    return accessTokenExpiry <= Date.now();
  }, []);

  // Helper: check if shop's authorization (UQ) is expired
  const isAuthExpired = useCallback((shop: ShopWithRole): boolean => {
    if (!shop.expire_time) return false;
    return shop.expire_time * 1000 <= Date.now();
  }, []);

  // Filter counts (computed from all shops, not search-filtered)
  const shopFilterCounts = useMemo(() => {
    const tokenOk = shops.filter(s => !isTokenExpired(s) && !isAuthExpired(s)).length;
    const tokenExp = shops.filter(s => isTokenExpired(s) && !isAuthExpired(s)).length;
    const authExp = shops.filter(s => isAuthExpired(s)).length;
    return { all: shops.length, tokenOk, tokenExp, authExp };
  }, [shops, isTokenExpired, isAuthExpired]);

  // Filter shops by search query + status filter
  const filteredShops = useMemo(() => {
    let result = shops;

    // Apply status filter
    if (shopFilterStatus === 'token_ok') {
      result = result.filter(s => !isTokenExpired(s) && !isAuthExpired(s));
    } else if (shopFilterStatus === 'token_expired') {
      result = result.filter(s => isTokenExpired(s) && !isAuthExpired(s));
    } else if (shopFilterStatus === 'auth_expired') {
      result = result.filter(s => isAuthExpired(s));
    }

    // Apply search
    if (shopSearchQuery.trim()) {
      const query = shopSearchQuery.toLowerCase().trim();
      result = result.filter(shop =>
        (shop.shop_name?.toLowerCase().includes(query)) ||
        (shop.shop_id.toString().includes(query))
      );
    }

    return result;
  }, [shops, shopSearchQuery, shopFilterStatus, isTokenExpired, isAuthExpired]);

  // Pagination logic - use filteredShops instead of shops
  const totalPages = useMemo(() => Math.ceil(filteredShops.length / SHOPS_PER_PAGE), [filteredShops.length]);

  const paginatedShops = useMemo(() => {
    const startIndex = (currentPage - 1) * SHOPS_PER_PAGE;
    const endIndex = startIndex + SHOPS_PER_PAGE;
    return filteredShops.slice(startIndex, endIndex);
  }, [filteredShops, currentPage]);

  // Reset về trang 1 khi search hoặc filter thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [shopSearchQuery, shopFilterStatus]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Hàm điều hướng trang
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Tạo danh sách số trang để hiển thị
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Hiển thị tất cả nếu ít trang
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Luôn hiển thị trang 1
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Các trang xung quanh trang hiện tại
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Luôn hiển thị trang cuối
      pages.push(totalPages);
    }

    return pages;
  };

  const columns = [
    {
      key: 'shop',
      header: 'Shop',
      width: '280px',
      mobileHeader: true,
      render: (shop: ShopWithRole) => (
        <CellShopInfo
          logo={shop.shop_logo}
          name={shop.shop_name || `Shop ${shop.shop_id}`}
          shopId={shop.shop_id}
          region={shop.region || 'VN'}
        />
      ),
    },
    {
      key: 'role',
      header: 'Quyền',
      mobileBadge: true,
      render: (shop: ShopWithRole) => (
        <CellBadge variant={shop.role === 'admin' ? 'success' : 'default'}>
          {shop.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
        </CellBadge>
      ),
    },
    // Per-app connection status (multi-partner)
    ...(partnerApps.length > 0 ? [{
      key: 'app_status',
      header: 'Apps',
      render: (shop: ShopWithRole) => (
        <ShopAppConnectionStatus
          shopId={shop.shop_id}
          compact
          onConnectApp={!readOnly && isSystemAdmin ? handleConnectApp : undefined}
        />
      ),
    }] : []),
    {
      key: 'token_updated_at',
      header: 'Ủy quyền',
      render: (shop: ShopWithRole) => (
        <CellText muted>{formatDate(shop.token_updated_at)}</CellText>
      ),
    },
    {
      key: 'expired_at',
      header: 'Hết hạn UQ',
      render: (shop: ShopWithRole) => (
        <CellText muted>{formatDate(getAuthorizationExpiry(shop))}</CellText>
      ),
    },
    {
      key: 'token_status',
      header: 'Token Status',
      render: (shop: ShopWithRole) => {
        const status = getTokenStatus(shop);
        return (
          <CellBadge variant={status.variant}>
            {status.label}
          </CellBadge>
        );
      },
    },
    // Chỉ hiển thị cột Thao tác khi không phải readOnly và là admin
    ...(!readOnly && isSystemAdmin ? [{
      key: 'actions',
      header: 'Thao tác',
      render: (shop: ShopWithRole) => (
        <CellActions>
          {/* Refresh Token */}
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); handleRefreshToken(shop); }}
            disabled={refreshingToken === shop.shop_id}
            title="Refresh access token"
          >
            {refreshingToken === shop.shop_id ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </Button>
          {/* Xóa shop */}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setShopToDelete(shop);
              setDeleteDialogOpen(true);
            }}
            title="Xóa shop"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </CellActions>
      ),
    }] : []),
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hoặc ID shop..."
                className="pl-9 h-9 text-sm"
                disabled
              />
            </div>
            {!readOnly && isSystemAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 h-8 md:h-9" disabled>
                  <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Kết nối tài khoản</span>
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-lg animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-8 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="flex flex-col flex-1 min-h-0">
        <CardHeader className="pb-4 flex-shrink-0 border-b bg-card sticky top-0 z-10">
          <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={`Tìm theo tên hoặc ID (${shops.length} shop)...`}
                  value={shopSearchQuery}
                  onChange={(e) => setShopSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              {shops.length > 0 && (
                <Select value={shopFilterStatus} onValueChange={(v) => setShopFilterStatus(v as typeof shopFilterStatus)}>
                  <SelectTrigger className="h-9 w-auto min-w-[160px] text-sm cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="cursor-pointer">Tất cả ({shopFilterCounts.all})</SelectItem>
                    <SelectItem value="token_ok" className="cursor-pointer">Token OK ({shopFilterCounts.tokenOk})</SelectItem>
                    <SelectItem value="token_expired" className="cursor-pointer">Token hết hạn ({shopFilterCounts.tokenExp})</SelectItem>
                    {shopFilterCounts.authExp > 0 && (
                      <SelectItem value="auth_expired" className="cursor-pointer">UQ hết hạn ({shopFilterCounts.authExp})</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            {!readOnly && isSystemAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-success hover:text-success hover:bg-success/10 h-8 md:h-9"
                  onClick={handleRefreshAllTokens}
                  disabled={refreshingAllTokens || shops.length === 0}
                >
                  {refreshingAllTokens ? (
                    <Spinner size="sm" className="mr-1.5" />
                  ) : (
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">Refresh All</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>
                <Button
                  size="sm"
                  className="bg-brand hover:bg-brand/90 h-8 md:h-9"
                  onClick={handleConnectNewShop}
                >
                  <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Kết nối tài khoản</span>
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>


        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <SimpleDataTable
              columns={columns}
              data={paginatedShops}
              keyExtractor={(shop) => shop.id}
              emptyMessage={shopSearchQuery ? 'Không tìm thấy shop nào' : 'Chưa có shop nào được kết nối'}
              emptyDescription={shopSearchQuery ? 'Thử tìm kiếm với từ khóa khác' : "Nhấn 'Kết nối tài khoản' để bắt đầu"}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/50">
                <div className="text-sm text-muted-foreground">
                  Trang {currentPage} / {totalPages}
                  <span className="ml-2 text-muted-foreground">
                    ({filteredShops.length} shop)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      typeof page === 'number' ? (
                        <Button
                          key={index}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => goToPage(page)}
                          className={`h-8 w-8 p-0 ${currentPage === page ? 'bg-brand hover:bg-brand/90' : ''}`}
                        >
                          {page}
                        </Button>
                      ) : (
                        <span key={index} className="px-2 text-muted-foreground">
                          {page}
                        </span>
                      )
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Xác nhận xóa Shop</DialogTitle>
            <DialogDescription>
              Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến shop sẽ bị xóa.
            </DialogDescription>
          </DialogHeader>
          {shopToDelete && (
            <div className="py-4">
              <div className="bg-destructive/10 rounded-lg p-4">
                <p className="font-medium text-foreground">
                  {shopToDelete.shop_name || `Shop ${shopToDelete.shop_id}`}
                </p>
                <p className="text-sm text-muted-foreground">ID: {shopToDelete.shop_id}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeleteShop} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa Shop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect New Shop Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Kết nối tài khoản Shopee</DialogTitle>
            <DialogDescription>
              Nhập thông tin Partner từ Shopee Open Platform. Tất cả shop trong tài khoản sẽ được tự động thêm vào hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partner_id">Partner ID <span className="text-destructive">*</span></Label>
              <Input
                id="partner_id"
                type="number"
                placeholder="Nhập Partner ID"
                value={partnerIdInput}
                onChange={(e) => setPartnerIdInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner_key">Partner Key <span className="text-destructive">*</span></Label>
              <Input
                id="partner_key"
                type="password"
                placeholder="Nhập Partner Key"
                value={partnerKeyInput}
                onChange={(e) => setPartnerKeyInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner_name">Tên Partner (tùy chọn)</Label>
              <Input
                id="partner_name"
                placeholder="VD: My App Partner"
                value={partnerNameInput}
                onChange={(e) => setPartnerNameInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              className="bg-brand hover:bg-brand/90"
              onClick={handleSubmitConnect}
              disabled={connecting || !partnerIdInput || !partnerKeyInput}
            >
              {connecting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Đang kết nối...
                </>
              ) : (
                'Kết nối với Shopee'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect App Dialog (multi-app flow) */}
      <Dialog open={connectAppDialogOpen} onOpenChange={setConnectAppDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Kết nối App: {selectedPartnerApp?.partner_name}</DialogTitle>
            <DialogDescription>
              Ủy quyền shop với app {selectedPartnerApp?.app_category === 'ads' ? 'Ads' : 'ERP'} để sử dụng các tính năng tương ứng.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">App</span>
                <span className="font-medium">{selectedPartnerApp?.partner_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loại</span>
                <span className="font-medium">{selectedPartnerApp?.app_category === 'ads' ? 'Ads Service' : 'ERP System'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Partner ID</span>
                <span className="font-mono text-xs">{selectedPartnerApp?.partner_id}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectAppDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              className="bg-brand hover:bg-brand/90 cursor-pointer"
              onClick={handleSubmitConnectApp}
              disabled={connectingApp}
            >
              {connectingApp ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Đang kết nối...
                </>
              ) : (
                'Ủy quyền với Shopee'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default ShopManagementPanel;
