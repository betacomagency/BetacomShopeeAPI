/**
 * Flash Sale Sync — ported from apishopee-flash-sale-sync Edge Function.
 *
 * Runs every 30 minutes: syncs flash sale list from Shopee API into DB for all shops.
 * Paginated per type (1=upcoming, 2=running, 3=ended), deduplicates by flash_sale_id.
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== SYNC LOGIC ====================

async function fetchAllFlashSales(
  credentials: PartnerCredentials,
  shopId: number,
  token: ShopToken
): Promise<Array<Record<string, unknown>>> {
  const allSales = new Map<number, Record<string, unknown>>();

  // Fetch all 3 types: 1=upcoming, 2=running, 3=ended
  for (const type of [1, 2, 3]) {
    let offset = 0;
    const limit = 100;

    while (offset <= 1000) { // Safety limit
      const result = await callShopeeApi({
        supabase, credentials,
        path: '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
        method: 'GET', shopId, token,
        extraParams: { type, offset, limit },
        edgeFunction: 'worker-flash-sale-sync',
        apiCategory: 'flash_sale',
        triggeredBy: TRIGGERED_BY,
      }) as { response?: { flash_sale_list?: Array<Record<string, unknown>>; more?: boolean }; error?: string };

      if (result.error) break;

      const list = result.response?.flash_sale_list || [];
      for (const sale of list) {
        const fsId = sale.flash_sale_id as number;
        if (!allSales.has(fsId)) {
          allSales.set(fsId, { ...sale, type });
        }
      }

      if (!result.response?.more || list.length < limit) break;
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

// ==================== MAIN ENTRY POINT ====================

let isRunning = false;

export async function runFlashSaleSync(): Promise<void> {
  if (isRunning) {
    console.log('[FS-SYNC] Previous run still active, skipping');
    return;
  }
  isRunning = true;

  try {
    console.log('[FS-SYNC] Starting flash sale sync for all shops');

    const { data: shops, error } = await supabase
      .from('apishopee_shops')
      .select('shop_id')
      .not('access_token', 'is', null);

    if (error) throw new Error(`Query error: ${error.message}`);
    if (!shops?.length) {
      console.log('[FS-SYNC] No shops to sync');
      return;
    }

    console.log(`[FS-SYNC] Syncing ${shops.length} shops`);

    let successCount = 0;
    let errorCount = 0;

    for (const shop of shops) {
      try {
        const credentials = await getPartnerCredentials(supabase, shop.shop_id);
        const token = await getShopToken(supabase, shop.shop_id);
        const result = await syncShopFlashSales(credentials, shop.shop_id, token);

        if (result.error) {
          console.error(`[FS-SYNC] Shop ${shop.shop_id} error: ${result.error}`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`[FS-SYNC] Shop ${shop.shop_id} failed:`, (err as Error).message);
        errorCount++;
      }

      // Rate limiting: 1s delay between shops
      await delay(1000);
    }

    console.log(`[FS-SYNC] Done: ${successCount} success, ${errorCount} errors out of ${shops.length} shops`);
  } catch (error) {
    console.error('[FS-SYNC] Fatal error:', (error as Error).message);
  } finally {
    isRunning = false;
  }
}
