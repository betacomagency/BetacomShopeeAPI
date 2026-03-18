/**
 * API Route Map - Maps Shopee API paths to partner app categories
 * Used by proxy to auto-detect which partner app credentials to use
 */

export type AppCategory = 'erp' | 'ads';

/**
 * Mapping of Shopee API path segments to app categories.
 * ERP app handles: products, orders, shop management, logistics, promotions
 * Ads app handles: advertising campaigns, marketing
 */
const API_ROUTE_MAP: Record<string, AppCategory> = {
  // ERP App endpoints
  'product': 'erp',
  'item': 'erp',
  'image': 'erp',
  'media_space': 'erp',
  'global_product': 'erp',
  'order': 'erp',
  'shop': 'erp',
  'logistics': 'erp',
  'first_mile': 'erp',
  'flash_sale': 'erp',
  'flash_deal': 'erp',
  'discount': 'erp',
  'voucher': 'erp',
  'returns': 'erp',
  'payment': 'erp',
  'finance': 'erp',
  'account_health': 'erp',
  'public': 'erp',
  'auth': 'erp',
  'review': 'erp',
  'chat': 'erp',
  'video': 'erp',
  'seller': 'erp',
  'bundle_deal': 'erp',
  'add_on_deal': 'erp',
  'top_picks': 'erp',
  'push': 'erp',

  // Ads App endpoints
  'ads': 'ads',
  'marketing': 'ads',
};

/**
 * Resolve app category from Shopee API path.
 * Extracts first path segment after /api/v2/ and looks up in route map.
 *
 * @example resolveAppCategory('/api/v2/product/get_item_list') => 'erp'
 * @example resolveAppCategory('/api/v2/ads/get_campaign_list') => 'ads'
 */
export function resolveAppCategory(apiPath: string): AppCategory {
  const match = apiPath.match(/\/api\/v2\/(\w+)/);
  if (!match) return 'erp';
  return API_ROUTE_MAP[match[1]] || 'erp';
}
