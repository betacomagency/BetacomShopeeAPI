/**
 * Flash Sale Sync — syncs flash sale list from Shopee API into DB.
 *
 * Runs every 30 minutes. Smart sync strategy:
 * - Incremental: only shops with pending auto-schedule or user-triggered sync
 * - Full sync: all shops, once per day (first run after midnight UTC)
 *
 * Rate limit mitigation:
 * - 1.5s delay between shops
 * - Retry on error_rate_limit (wait 5s, max 2 retries)
 */
import { supabase } from '../lib/supabase';
import {
  callShopeeApi,
  getPartnerCredentials,
  getShopToken,
  PartnerCredentials,
  ShopToken,
} from '../lib/shopee-api';

const TRIGGERED_BY = 'cron' as const;
const DELAY_BETWEEN_SHOPS_MS = 1500;
const RATE_LIMIT_RETRY_DELAY_MS = 5000;
const RATE_LIMIT_MAX_RETRIES = 2;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Track last full sync time to trigger daily full sync
let lastFullSyncDate = '';

// ==================== SYNC LOGIC ====================

/**
 * Fetch flash sales for a shop with rate limit retry.
 * On error_rate_limit: wait 5s and retry up to 2 times.
 */
async function fetchAllFlashSales(
  credentials: PartnerCredentials,
  shopId: number,
  token: ShopToken
): Promise<Array<Record<string, unknown>>> {
  const allSales = new Map<number, Record<string, unknown>>();

  for (const type of [1, 2, 3]) {
    let offset = 0;
    const limit = 100;

    while (offset <= 1000) {
      let result: Record<string, unknown> | null = null;
      let retries = 0;

      // Retry loop for rate limit errors
      while (retries <= RATE_LIMIT_MAX_RETRIES) {
        result = await callShopeeApi({
          supabase, credentials,
          path: '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
          method: 'GET', shopId, token,
          extraParams: { type, offset, limit },
          edgeFunction: 'worker-flash-sale-sync',
          apiCategory: 'flash_sale',
          triggeredBy: TRIGGERED_BY,
        }) as Record<string, unknown>;

        // If rate limited, wait and retry
        if ((result as { error?: string }).error === 'error_rate_limit' && retries < RATE_LIMIT_MAX_RETRIES) {
          retries++;
          console.warn(`[FS-SYNC] Rate limited on shop ${shopId} type=${type}, retry ${retries}/${RATE_LIMIT_MAX_RETRIES} after ${RATE_LIMIT_RETRY_DELAY_MS}ms`);
          await delay(RATE_LIMIT_RETRY_DELAY_MS);
          continue;
        }
        break;
      }

      if (!result || (result as { error?: string }).error) break;

      const response = result.response as { flash_sale_list?: Array<Record<string, unknown>>; more?: boolean } | undefined;
      const list = response?.flash_sale_list || [];
      for (const sale of list) {
        const fsId = sale.flash_sale_id as number;
        if (!allSales.has(fsId)) {
          allSales.set(fsId, { ...sale, type });
        }
      }

      if (!response?.more || list.length < limit) break;
      offset += limit;
    }
  }

  return Array.from(allSales.values());
}

async function syncShopFlashSales(
  credentials: PartnerCredentials,
  shopId: number,
  token: ShopToken
): Promise<{ synced: number; error?: string }> {
  try {
    const flashSales = await fetchAllFlashSales(credentials, shopId, token);

    if (flashSales.length === 0) {
      return { synced: 0 };
    }

    const syncedAt = new Date().toISOString();

    const upsertData = flashSales.map(sale => ({
      shop_id: shopId,
      flash_sale_id: sale.flash_sale_id,
      timeslot_id: sale.timeslot_id,
      status: sale.status,
      start_time: sale.start_time,
      end_time: sale.end_time,
      enabled_item_count: sale.enabled_item_count || 0,
      item_count: sale.item_count || 0,
      type: sale.type,
      remindme_count: sale.remindme_count || 0,
      click_count: sale.click_count || 0,
      raw_response: sale,
      synced_at: syncedAt,
    }));

    const { error: upsertError } = await supabase
      .from('apishopee_flash_sale_data')
      .upsert(upsertData, { onConflict: 'shop_id,flash_sale_id' });

    if (upsertError) {
      return { synced: 0, error: upsertError.message };
    }

    // Delete stale records: status=0 (deleted on Shopee)
    await supabase
      .from('apishopee_flash_sale_data')
      .delete()
      .eq('shop_id', shopId)
      .eq('status', 0);

    // Delete stale upcoming records not in current fetch
    const currentFsIds = flashSales.map(s => s.flash_sale_id as number);
    if (currentFsIds.length > 0) {
      const { data: localUpcoming } = await supabase
        .from('apishopee_flash_sale_data')
        .select('flash_sale_id')
        .eq('shop_id', shopId)
        .eq('type', 1);

      const staleIds = (localUpcoming || [])
        .map(r => r.flash_sale_id as number)
        .filter(id => !currentFsIds.includes(id));

      if (staleIds.length > 0) {
        await supabase
          .from('apishopee_flash_sale_data')
          .delete()
          .eq('shop_id', shopId)
          .in('flash_sale_id', staleIds);
      }
    }

    // Update sync status
    await supabase
      .from('apishopee_sync_status')
      .upsert({ shop_id: shopId, flash_sales_synced_at: syncedAt, updated_at: syncedAt },
        { onConflict: 'shop_id' });

    return { synced: flashSales.length };
  } catch (err) {
    return { synced: 0, error: (err as Error).message };
  }
}

// ==================== SMART SHOP SELECTION ====================

/**
 * Get shops that need incremental sync:
 * 1. Shops with pending/retry auto-schedule jobs
 * 2. Shops with running/upcoming flash sales (need fresh data)
 */
async function getShopsForIncrementalSync(): Promise<number[]> {
  const shopIds = new Set<number>();

  // Shops with pending auto-schedule jobs
  const { data: pendingJobs } = await supabase
    .from('apishopee_flash_sale_auto_history')
    .select('shop_id')
    .in('status', ['scheduled', 'processing', 'retry']);

  for (const job of pendingJobs || []) {
    shopIds.add(job.shop_id);
  }

  // Shops with running or upcoming flash sales (type 1 or 2)
  const { data: activeShops } = await supabase
    .from('apishopee_flash_sale_data')
    .select('shop_id')
    .in('type', [1, 2]);

  // Deduplicate
  const seenShops = new Set<number>();
  for (const row of activeShops || []) {
    if (!seenShops.has(row.shop_id)) {
      shopIds.add(row.shop_id);
      seenShops.add(row.shop_id);
    }
  }

  return Array.from(shopIds);
}

/**
 * Get all shops with valid tokens (for full daily sync).
 */
async function getAllShops(): Promise<number[]> {
  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('shop_id')
    .not('access_token', 'is', null);

  if (error) throw new Error(`Query error: ${error.message}`);
  return (data || []).map(s => s.shop_id);
}

// ==================== MAIN ENTRY POINT ====================

let _isRunning = false;

export function isSyncRunning(): boolean {
  return _isRunning;
}

export async function runFlashSaleSync(): Promise<void> {
  if (_isRunning) {
    console.log('[FS-SYNC] Previous run still active, skipping');
    return;
  }
  _isRunning = true;

  try {
    // Determine sync mode: full (daily) or incremental
    const todayDate = new Date().toISOString().slice(0, 10);
    const isFullSync = lastFullSyncDate !== todayDate;

    let shopIds: number[];

    if (isFullSync) {
      shopIds = await getAllShops();
      console.log(`[FS-SYNC] FULL daily sync: ${shopIds.length} shops`);
    } else {
      shopIds = await getShopsForIncrementalSync();
      console.log(`[FS-SYNC] Incremental sync: ${shopIds.length} shops (with active/pending flash sales)`);
    }

    if (shopIds.length === 0) {
      console.log('[FS-SYNC] No shops to sync');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const shopId of shopIds) {
      try {
        const credentials = await getPartnerCredentials(supabase, shopId);
        const token = await getShopToken(supabase, shopId);
        const result = await syncShopFlashSales(credentials, shopId, token);

        if (result.error) {
          console.error(`[FS-SYNC] Shop ${shopId} error: ${result.error}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`[FS-SYNC] Shop ${shopId} failed:`, (err as Error).message);
        errorCount++;
      }

      await delay(DELAY_BETWEEN_SHOPS_MS);
    }

    // Mark full sync done for today
    if (isFullSync) {
      lastFullSyncDate = todayDate;
    }

    console.log(`[FS-SYNC] Done (${isFullSync ? 'FULL' : 'incremental'}): ${successCount} success, ${errorCount} errors out of ${shopIds.length} shops`);
  } catch (error) {
    console.error('[FS-SYNC] Fatal error:', (error as Error).message);
  } finally {
    _isRunning = false;
  }
}
