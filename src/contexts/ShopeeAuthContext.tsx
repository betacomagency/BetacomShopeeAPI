/**
 * ShopeeAuthContext - Share Shopee auth state across all components
 * Giải quyết vấn đề mỗi useShopeeAuth() tạo state riêng
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import {
  getStoredToken,
  storeToken,
  clearToken,
  isSupabaseConfigured,
  getAuthorizationUrl,
  authenticateWithCode,
  refreshToken,
  isConfigValid,
} from '@/lib/shopee';
import type { AccessToken } from '@/lib/shopee';
import { saveUserShop, getUserShops } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { usePermissionsContext } from '@/contexts/PermissionsContext';

// Simple in-memory cache for shops data
const shopsCache = new Map<string, { data: ShopInfo[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory storage for sensitive OAuth data (never persisted to sessionStorage)
let pendingPartnerInfo: PartnerInfo | undefined = undefined;
let pendingPartnerAppId: string | undefined = undefined;

interface ShopInfo {
  shop_id: number;
  shop_name: string | null;
  shop_logo: string | null;
  region: string | null;
  is_active: boolean;
}

interface PartnerInfo {
  partner_id: number;
  partner_key: string;
  partner_name?: string;
  partner_created_by?: string;
}

interface ShopeeAuthContextType {
  token: AccessToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  useBackend: boolean;
  error: string | null;
  user: { id: string; email?: string } | null;
  shops: ShopInfo[];
  selectedShopId: number | null;
  login: (callbackUrl?: string, partnerAccountId?: string, partnerInfo?: PartnerInfo) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  handleCallback: (code: string, shopId?: number, partnerAccountId?: string, mainAccountId?: number) => Promise<void>;
  switchShop: (shopId: number) => Promise<void>;
}

const ShopeeAuthContext = createContext<ShopeeAuthContextType | undefined>(undefined);

const DEFAULT_CALLBACK =
  import.meta.env.VITE_SHOPEE_CALLBACK_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://sshop.betacom.agency/auth/callback');

export function ShopeeAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<AccessToken | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);

  const initialLoadDoneRef = useRef(false);
  const loadingRef = useRef(false);

  const { systemRole, managedMemberIds, isLoading: permissionsLoading } = usePermissionsContext();

  const useBackend = isSupabaseConfigured();
  const isConfigured = isConfigValid() || useBackend;
  const isAuthenticated = !!token && !error;

  // Load shops based on role visibility
  const loadShopsByRole = useCallback(async (userId: string): Promise<ShopInfo[]> => {
    if (systemRole === 'super_admin' || systemRole === 'admin') {
      // Admin/Super admin: load ALL shops
      const { data } = await supabase
        .from('apishopee_shops')
        .select('shop_id, shop_name, shop_logo, region')
        .order('shop_name');
      return (data || []).map(s => ({ ...s, is_active: true }));
    }

    if (systemRole === 'leader' && managedMemberIds.length > 0) {
      // Leader: own shops + managed members' shops
      const allProfileIds = [userId, ...managedMemberIds];
      const { data } = await supabase
        .from('apishopee_shop_members')
        .select('shop:apishopee_shops(shop_id, shop_name, shop_logo, region)')
        .in('profile_id', allProfileIds)
        .eq('is_active', true);

      // Deduplicate by shop_id
      const shopMap = new Map<number, ShopInfo>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data || []).forEach((d: any) => {
        const shop = Array.isArray(d.shop) ? d.shop[0] : d.shop;
        if (shop?.shop_id) shopMap.set(shop.shop_id, { ...shop, is_active: true });
      });
      return Array.from(shopMap.values());
    }

    // Member (or leader with no managed members): only own shops
    const userShops = await getUserShops(userId);
    return (userShops || [])
      .filter((s): s is typeof s & { shop_id: number } => typeof s.shop_id === 'number')
      .map(s => ({
        shop_id: s.shop_id,
        shop_name: s.shop_name ?? null,
        shop_logo: s.shop_logo ?? null,
        region: s.region ?? null,
        is_active: true,
      }));
  }, [systemRole, managedMemberIds]);

  const loadTokenFromSource = useCallback(async (userId?: string, targetShopId?: number, forceRefresh = false) => {
    if (loadingRef.current && !forceRefresh) {
      return false;
    }
    loadingRef.current = true;

    try {
      if (userId) {
        const cached = shopsCache.get(userId);
        const now = Date.now();

        let userShops: ShopInfo[];
        if (cached && (now - cached.timestamp) < CACHE_TTL && !forceRefresh) {
          userShops = cached.data;
          setShops(cached.data);
        } else {
          // Use role-based shop loading
          userShops = await loadShopsByRole(userId);

          if (userShops.length > 0) {
            setShops(userShops);
            shopsCache.set(userId, { data: userShops, timestamp: now });
          }
        }

        if (userShops && userShops.length > 0) {
          // Ưu tiên: targetShopId > localStorage (nếu user có quyền) > shop đầu tiên từ DB
          let shopToLoadId = targetShopId;
          
          if (!shopToLoadId) {
            // Kiểm tra localStorage có shop_id không và user có quyền truy cập không
            const storedToken = await getStoredToken();
            if (storedToken?.shop_id) {
              const hasAccess = userShops.some(s => s.shop_id === storedToken.shop_id);
              if (hasAccess) {
                shopToLoadId = storedToken.shop_id;
              }
            }
          }
          
          // Fallback về shop đầu tiên từ database
          if (!shopToLoadId) {
            shopToLoadId = userShops[0]?.shop_id;
          }
          
          if (shopToLoadId) {
            const { data: shopData } = await supabase
              .from('apishopee_shops')
              .select('shop_id, access_token, refresh_token, expired_at, merchant_id')
              .eq('shop_id', shopToLoadId)
              .single();

            if (shopData?.access_token) {
              const dbToken: AccessToken = {
                access_token: shopData.access_token,
                refresh_token: shopData.refresh_token,
                shop_id: shopData.shop_id,
                expired_at: shopData.expired_at,
                expire_in: 14400,
                merchant_id: shopData.merchant_id,
              };

              await storeToken(dbToken);
              setToken(dbToken);
              setSelectedShopId(shopData.shop_id);
              return true;
            }
          }
        }
      }
      
      // Fallback: nếu không có userId hoặc không có shops từ DB, thử localStorage
      const storedToken = await getStoredToken();
      if (storedToken?.shop_id && storedToken?.access_token) {
        setToken(storedToken);
        setSelectedShopId(storedToken.shop_id);
        return true;
      }
      
      return false;
    } catch {
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, [loadShopsByRole]);

  useEffect(() => {
    // Wait for permissions to load before loading shops (we need role to determine visibility)
    if (permissionsLoading) return;

    let mounted = true;

    async function initLoad() {
      if (initialLoadDoneRef.current) {
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setUser({ id: session.user.id, email: session.user.email });
          await loadTokenFromSource(session.user.id, undefined, true);
        }
      } catch {
        // ignore init error
      } finally {
        if (mounted) {
          setIsLoading(false);
          initialLoadDoneRef.current = true;
        }
      }
    }

    initLoad();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Chỉ load lại nếu user thực sự thay đổi
          if (user?.id !== session.user.id) {
            setUser({ id: session.user.id, email: session.user.email });
            // Load ở background, KHÔNG set isLoading = true
            loadTokenFromSource(session.user.id, undefined, true);
          }
        } else if (event === 'SIGNED_OUT') {
          setToken(null);
          setUser(null);
          setShops([]);
          setSelectedShopId(null);
          initialLoadDoneRef.current = false;
          shopsCache.clear();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTokenFromSource, permissionsLoading]);

  const login = useCallback(
    async (callbackUrl = DEFAULT_CALLBACK, partnerAccountId?: string, partnerInfo?: PartnerInfo) => {
      if (!isConfigured && !partnerInfo) {
        setError('SDK not configured. Please provide partner credentials.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        if (partnerInfo) {
          // Store in memory only — never persist partner_key to sessionStorage
          pendingPartnerInfo = partnerInfo;
        }

        const authUrl = await getAuthorizationUrl(callbackUrl, partnerAccountId, partnerInfo);
        window.location.href = authUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get auth URL');
        setIsLoading(false);
      }
    },
    [isConfigured]
  );

  const handleCallback = useCallback(
    async (code: string, shopId?: number, partnerAccountId?: string, mainAccountId?: number) => {
      setIsLoading(true);
      setError(null);

      // Read from in-memory storage (not sessionStorage) to protect partner_key
      const partnerInfo = pendingPartnerInfo;
      pendingPartnerInfo = undefined;

      // Check if this is an app-specific OAuth callback (multi-partner flow)
      const partnerAppId = pendingPartnerAppId;
      pendingPartnerAppId = undefined;

      try {
        let newToken: AccessToken;

        if (partnerAppId) {
          // App-specific flow: reuse authenticateWithCode pattern (proven to work from callback)
          // Pass partner_app_id via partnerInfo so edge function uses get-app-token internally
          newToken = await authenticateWithCode(code, shopId, partnerAccountId, {
            partner_app_id: partnerAppId,
          } as unknown as PartnerInfo, mainAccountId);
        } else {
          // Legacy flow: use get-token with partner_info
          newToken = await authenticateWithCode(code, shopId, partnerAccountId, partnerInfo, mainAccountId);
        }

        // Main account auth: response có shop_id_list
        const shopIdList = newToken.shop_id_list;
        const isMerchantAuth = shopIdList && shopIdList.length > 0;

        if (isMerchantAuth) {
          // === MAIN ACCOUNT AUTH: nhiều shop ===
          const firstShopId = shopIdList[0];
          const tokenForStorage: AccessToken = { ...newToken, shop_id: firstShopId };
          await storeToken(tokenForStorage);
          setToken(tokenForStorage);

          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && newToken.access_token && newToken.refresh_token) {
              // Lưu tất cả shop song song + tạo shop_members
              await Promise.all(shopIdList.map(sid =>
                saveUserShop(
                  user.id,
                  sid,
                  newToken.access_token,
                  newToken.refresh_token,
                  newToken.expired_at || Date.now() + 4 * 60 * 60 * 1000,
                  newToken.merchant_id,
                  undefined,
                  partnerInfo
                )
              ));
              console.log(`[AUTH] All ${shopIdList.length} shops saved for merchant:`, newToken.merchant_id);

              // Fetch shop info cho từng shop
              await new Promise(resolve => setTimeout(resolve, 1000));
              const infoPromises = shopIdList.map(sid =>
                supabase.functions.invoke('shopee-shop', {
                  body: { action: 'get-full-info', shop_id: sid, force_refresh: true },
                }).then(({ data }) => {
                  if (data?.info?.shop_name) {
                    console.log(`[AUTH] Shop info fetched: ${data.info.shop_name} (${sid})`);
                  }
                }).catch(err => {
                  console.error(`[AUTH] Failed to fetch info for shop ${sid}:`, err);
                })
              );
              await Promise.all(infoPromises);
            }
          } catch (err) {
            console.error('[AUTH] Error saving merchant shops:', err);
          }
        } else {
          // === SHOP-LEVEL AUTH (fallback) ===
          await storeToken(newToken);
          setToken(newToken);

          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && newToken.shop_id && newToken.access_token && newToken.refresh_token) {
              await saveUserShop(
                user.id,
                newToken.shop_id,
                newToken.access_token,
                newToken.refresh_token,
                newToken.expired_at || Date.now() + 4 * 60 * 60 * 1000,
                newToken.merchant_id,
                undefined,
                partnerInfo
              );

              console.log('[AUTH] Shop and token saved to database');

              await new Promise(resolve => setTimeout(resolve, 1000));

              try {
                const { data, error } = await supabase.functions.invoke('shopee-shop', {
                  body: { action: 'get-full-info', shop_id: newToken.shop_id, force_refresh: true },
                });

                if (error) {
                  console.error('[AUTH] Failed to fetch shop info:', error);
                } else if (data?.info?.shop_name) {
                  console.log('[AUTH] Shop info fetched:', data.info.shop_name);
                }
              } catch (err) {
                console.error('[AUTH] Error fetching shop info:', err);
              }
            }
          } catch (err) {
            console.error('[AUTH] Error saving shop to database:', err);
          }
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await clearToken();
      setToken(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token?.refresh_token) {
      setError('No refresh token available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newToken = await refreshToken(token.refresh_token, token.shop_id, token.merchant_id);

      await storeToken(newToken);
      setToken(newToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const switchShop = useCallback(async (shopId: number) => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    if (shopId === selectedShopId) {
      return;
    }

    // Không set isLoading = true, giữ UI hiện tại
    setError(null);

    try {
      await loadTokenFromSource(user.id, shopId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch shop');
    }
  }, [user?.id, selectedShopId, loadTokenFromSource]);

  // Memoize context value để tránh re-render toàn bộ consumer mỗi khi provider render
  const value = useMemo(() => ({
    token,
    isAuthenticated,
    isLoading,
    isConfigured,
    useBackend,
    error,
    user,
    shops,
    selectedShopId,
    login,
    logout,
    refresh,
    handleCallback,
    switchShop,
  }), [token, isAuthenticated, isLoading, isConfigured, useBackend, error, user, shops, selectedShopId, login, logout, refresh, handleCallback, switchShop]);

  return (
    <ShopeeAuthContext.Provider value={value}>
      {children}
    </ShopeeAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShopeeAuth(): ShopeeAuthContextType {
  const context = useContext(ShopeeAuthContext);
  if (context === undefined) {
    throw new Error('useShopeeAuth must be used within a ShopeeAuthProvider');
  }
  return context;
}
