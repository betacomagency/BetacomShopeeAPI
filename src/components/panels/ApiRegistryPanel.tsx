/**
 * API Registry Panel - Static list of all Shopee APIs used, with live health badges
 */

import { useEndpointHealth } from '@/hooks/useApiLogs';
import {
  Store,
  Package,
  Zap,
  Star,
  Key,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ApiEntry {
  method: 'GET' | 'POST';
  endpoint: string;
  description: string;
  edgeFunction: string;
  rateLimit?: string;
}

interface ApiCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  apis: ApiEntry[];
}

const API_REGISTRY: ApiCategory[] = [
  {
    key: 'shop',
    label: 'Shop',
    icon: Store,
    color: 'text-blue-600 bg-blue-50',
    apis: [
      { method: 'GET', endpoint: '/api/v2/shop/get_shop_info', description: 'Lấy thông tin shop', edgeFunction: 'shopee-shop' },
      { method: 'GET', endpoint: '/api/v2/shop/get_profile', description: 'Lấy profile shop', edgeFunction: 'shopee-shop' },
    ],
  },
  {
    key: 'product',
    label: 'Product',
    icon: Package,
    color: 'text-green-600 bg-green-50',
    apis: [
      { method: 'GET', endpoint: '/api/v2/product/get_item_list', description: 'Lấy danh sách sản phẩm', edgeFunction: 'apishopee-product' },
      { method: 'GET', endpoint: '/api/v2/product/get_item_base_info', description: 'Lấy thông tin chi tiết sản phẩm', edgeFunction: 'apishopee-product' },
      { method: 'GET', endpoint: '/api/v2/product/get_model_list', description: 'Lấy danh sách model/variant', edgeFunction: 'apishopee-product' },
    ],
  },
  {
    key: 'flash_sale',
    label: 'Flash Sale',
    icon: Zap,
    color: 'text-orange-600 bg-orange-50',
    apis: [
      { method: 'GET', endpoint: '/api/v2/shop_flash_sale/get_shop_flash_sale_list', description: 'Lấy danh sách Flash Sale', edgeFunction: 'apishopee-flash-sale' },
      { method: 'GET', endpoint: '/api/v2/shop_flash_sale/get_shop_flash_sale_items', description: 'Lấy items của Flash Sale', edgeFunction: 'apishopee-flash-sale' },
      { method: 'GET', endpoint: '/api/v2/shop_flash_sale/get_timeslot_id', description: 'Lấy timeslots khả dụng', edgeFunction: 'apishopee-flash-sale' },
      { method: 'POST', endpoint: '/api/v2/shop_flash_sale/create_shop_flash_sale', description: 'Tạo Flash Sale', edgeFunction: 'apishopee-flash-sale' },
      { method: 'POST', endpoint: '/api/v2/shop_flash_sale/add_shop_flash_sale_items', description: 'Thêm items vào Flash Sale', edgeFunction: 'apishopee-flash-sale' },
      { method: 'POST', endpoint: '/api/v2/shop_flash_sale/delete_shop_flash_sale', description: 'Xóa Flash Sale', edgeFunction: 'apishopee-flash-sale' },
      { method: 'POST', endpoint: '/api/v2/shop_flash_sale/update_shop_flash_sale_items', description: 'Cập nhật items Flash Sale', edgeFunction: 'apishopee-flash-sale' },
      { method: 'POST', endpoint: '/api/v2/shop_flash_sale/delete_shop_flash_sale_items', description: 'Xóa items Flash Sale', edgeFunction: 'apishopee-flash-sale' },
    ],
  },
  {
    key: 'review',
    label: 'Review',
    icon: Star,
    color: 'text-yellow-600 bg-yellow-50',
    apis: [
      { method: 'GET', endpoint: '/api/v2/product/get_comment', description: 'Lấy đánh giá sản phẩm', edgeFunction: 'apishopee-reviews-sync' },
      { method: 'POST', endpoint: '/api/v2/product/reply_comment', description: 'Trả lời đánh giá', edgeFunction: 'apishopee-auto-reply' },
    ],
  },
  {
    key: 'auth',
    label: 'Auth',
    icon: Key,
    color: 'text-red-600 bg-red-50',
    apis: [
      { method: 'POST', endpoint: '/api/v2/auth/token/get', description: 'Lấy access token từ auth code', edgeFunction: 'apishopee-auth' },
      { method: 'POST', endpoint: '/api/v2/auth/access_token/get', description: 'Refresh access token', edgeFunction: 'shopee-token-refresh' },
    ],
  },
];

function getHealthBadge(successRate?: number, totalCalls?: number) {
  if (totalCalls === undefined || totalCalls === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        No data
      </span>
    );
  }
  if (successRate !== undefined && successRate >= 95) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <CheckCircle className="w-3 h-3" />
        {successRate.toFixed(0)}%
      </span>
    );
  }
  if (successRate !== undefined && successRate >= 80) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
        <AlertTriangle className="w-3 h-3" />
        {successRate.toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
      <XCircle className="w-3 h-3" />
      {successRate?.toFixed(0) || 0}%
    </span>
  );
}

export function ApiRegistryPanel() {
  const { data: health, isLoading, refetch, isFetching } = useEndpointHealth();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">API Registry</h2>
          <p className="text-sm text-slate-500">Danh sách tất cả Shopee API đang sử dụng. Health badge dựa trên 24h gần nhất.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* API Categories */}
      {API_REGISTRY.map((category) => {
        const Icon = category.icon;
        const [textColor, bgColor] = category.color.split(' ');
        return (
          <div key={category.key} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className={`p-1.5 rounded-lg ${bgColor || ''} ${textColor || ''}`}>
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">{category.label}</h3>
              <span className="text-xs text-slate-400">{category.apis.length} endpoints</span>
            </div>

            {/* API list */}
            <div className="divide-y divide-slate-100">
              {category.apis.map((api) => {
                const endpointHealth = health?.[api.endpoint];
                return (
                  <div key={api.endpoint} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        api.method === 'GET'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {api.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-700 truncate">{api.endpoint}</p>
                      <p className="text-xs text-slate-400">{api.description}</p>
                    </div>
                    <span className="text-xs text-slate-400 hidden md:block">{api.edgeFunction}</span>
                    {isLoading ? (
                      <div className="w-16 h-5 bg-slate-100 rounded-full animate-pulse" />
                    ) : (
                      getHealthBadge(endpointHealth?.successRate, endpointHealth?.totalCalls)
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary footer */}
      <div className="flex items-center justify-center gap-6 text-xs text-slate-400 pb-4">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {API_REGISTRY.reduce((sum, cat) => sum + cat.apis.length, 0)} API endpoints
        </div>
        <div className="flex items-center gap-1">
          {API_REGISTRY.length} categories
        </div>
      </div>
    </div>
  );
}
