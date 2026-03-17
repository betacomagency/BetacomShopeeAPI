/**
 * ShopSelector Component - Cho phép chuyển đổi giữa các shop Shopee đã kết nối
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShopeeAuth } from '@/hooks/useShopeeAuth';
import { Check, ChevronDown, Store, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShopSelector() {
  const { shops, selectedShopId, switchShop, isLoading } = useShopeeAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Tìm shop đang được chọn
  const currentShop = shops.find((shop) => shop.shop_id === selectedShopId);

  // Chỉ hiển thị dropdown khi có nhiều hơn 1 shop
  const hasMultipleShops = shops.length > 1;

  // Filter shops theo search query
  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return shops;
    const query = searchQuery.toLowerCase().trim();
    return shops.filter(shop => 
      shop.shop_name?.toLowerCase().includes(query) ||
      shop.shop_id.toString().includes(query)
    );
  }, [shops, searchQuery]);

  // Xử lý chuyển shop
  const handleSwitchShop = async (shopId: number) => {
    if (shopId === selectedShopId) {
      setIsOpen(false);
      setSearchQuery('');
      return;
    }

    setIsSwitching(true);
    try {
      await switchShop(shopId);
      // Lưu shop đã chọn vào localStorage
      localStorage.setItem('selected_shop_id', shopId.toString());

      // Invalidate all queries để refetch data cho shop mới
      // Không cần reload trang - React Query sẽ tự động refetch
      await queryClient.invalidateQueries({ queryKey: ['realtime'] });
      await queryClient.invalidateQueries({ queryKey: ['syncStatus'] });

      setIsOpen(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to switch shop:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Reset search khi đóng dropdown
  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  // Không hiển thị nếu chưa có shop nào
  if (shops.length === 0 || isLoading) {
    return null;
  }

  return (
    <div className="relative w-full">
      <button
        onClick={() => hasMultipleShops && setIsOpen(!isOpen)}
        disabled={!hasMultipleShops || isSwitching}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
          hasMultipleShops
            ? 'hover:bg-brand/10 hover:border-brand/20 cursor-pointer'
            : 'cursor-default',
          isOpen && 'bg-brand/10 border-brand/20',
          !isOpen && 'border-border bg-card'
        )}
      >
        {/* Shop Logo hoặc Icon */}
        {currentShop?.shop_logo ? (
          <img
            src={currentShop.shop_logo}
            alt={currentShop.shop_name || 'Shop'}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <Store className="w-5 h-5 text-brand" />
        )}

        {/* Shop Name */}
        <div className="text-left flex-1 min-w-0 overflow-hidden">
          <p className="text-sm font-medium text-foreground truncate">
            {currentShop?.shop_name || `Shop ${selectedShopId}`}
          </p>
        </div>

        {/* Loading hoặc Dropdown Arrow */}
        {isSwitching ? (
          <Loader2 className="w-4 h-4 text-brand animate-spin" />
        ) : hasMultipleShops ? (
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        ) : null}
      </button>

      {/* Dropdown Menu */}
      {isOpen && hasMultipleShops && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-xl shadow-lg border border-border py-2 z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Chọn Shop
              </p>
            </div>

            {/* Search Input */}
            <div className="px-3 py-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-base border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filteredShops.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Không tìm thấy shop
                </div>
              ) : (
                filteredShops.map((shop) => {
                  const isSelected = shop.shop_id === selectedShopId;

                  return (
                    <button
                      key={shop.shop_id}
                      onClick={() => handleSwitchShop(shop.shop_id)}
                      disabled={isSwitching}
                      className={cn(
                        'w-full px-3 py-2.5 flex items-center gap-3 hover:bg-muted transition-colors cursor-pointer',
                        isSelected && 'bg-brand/10'
                      )}
                    >
                      {/* Shop Logo */}
                      {shop.shop_logo ? (
                        <img
                          src={shop.shop_logo}
                          alt={shop.shop_name || 'Shop'}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                          <Store className="w-4 h-4 text-brand" />
                        </div>
                      )}

                      {/* Shop Info */}
                      <div className="flex-1 text-left min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isSelected ? 'text-brand' : 'text-foreground'
                          )}
                        >
                          {shop.shop_name || `Shop ${shop.shop_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {shop.shop_id}
                        </p>
                      </div>

                      {/* Check Icon */}
                      {isSelected && (
                        <Check className="w-5 h-5 text-brand flex-shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
