/**
 * Flash Sale Auto Scheduler — ported from apishopee-flash-sale-scheduler Edge Function.
 *
 * Runs every 2 minutes via node-cron:
 * 1. Find pending/retry jobs in apishopee_flash_sale_auto_history
 * 2. Check if timeslot already has a Flash Sale
 * 3. If not → create FS and add items
 * 4. If yes → mark as error
 *
 * Key differences from Edge Function:
 * - No serve() HTTP handler — exported async function
 * - Uses shopee-api.ts for signing + rate-limited API calls
 * - No proxy — direct HTTPS from EC2
 * - No timeout limit
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  callShopeeApi,
  getPartnerCredentials,
  getShopToken,
  PartnerCredentials,
  ShopToken,
} from '../lib/shopee-api';
import { config } from '../config';

// ==================== TYPES ====================

interface ScheduledJob {
  id: string;
  shop_id: number;
  user_id: string;
  timeslot_id: number;
  slot_start_time: number;
  slot_end_time: number;
  items_count: number;
  scheduled_at: string;
  retry_count?: number;
  items_data?: Array<Record<string, unknown>>;
}

interface FlashSaleItem {
  item_id: number;
  item_name?: string;
  status: number;
  purchase_limit: number;
  campaign_stock?: number;
  input_promotion_price?: number;
  models?: FlashSaleModel[];
}

interface FlashSaleModel {
  model_id: number;
  item_id: number;
  input_promotion_price: number;
  campaign_stock: number;
  status?: number;
}

// ==================== CONSTANTS ====================

const MAX_RETRY_COUNT = 3;
const MAX_CONCURRENT_SHOPS = 5;
const TRIGGERED_BY = 'scheduler' as const;

// ==================== HELPERS ====================

function getRetryDelayMinutes(retryCount: number): number {
  const delays = [1, 3, 5];
  return delays[Math.min(retryCount, delays.length - 1)];
}

function isTransientError(error: string): boolean {
  const transientPatterns = [
    'network', 'timeout', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET',
    'rate_limit', 'too_many_requests', '429', '500', '502', '503', '504',
    'temporarily_unavailable', 'service_unavailable',
  ];
  const lower = error.toLowerCase();
  return transientPatterns.some(p => lower.includes(p.toLowerCase()));
}

async function sendFailureAlert(job: ScheduledJob, errorMsg: string): Promise<void> {
  if (!config.flashSaleAlertWebhook) return;
  try {
    await fetch(config.flashSaleAlertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Flash Sale Auto FAILED (after ${job.retry_count || 0} retries)\n` +
              `Shop: ${job.shop_id}\nTimeslot: ${job.timeslot_id}\nError: ${errorMsg}`,
        shop_id: job.shop_id,
        timeslot_id: job.timeslot_id,
        error: errorMsg,
        retry_count: job.retry_count || 0,
      }),
    });
  } catch (e) {
    console.error(`[FS-SCHEDULER] Alert send failed:`, (e as Error).message);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== FLASH SALE LOGIC ====================

async function checkTimeslotHasFlashSale(
  credentials: PartnerCredentials,
  shopId: number,
  token: ShopToken,
  timeslotId: number
): Promise<{ exists: boolean; flashSaleId?: number }> {
  const result = await callShopeeApi({
    supabase, credentials,
    path: '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
    method: 'GET', shopId, token,
    extraParams: { type: 0, offset: 0, limit: 100 },
    edgeFunction: 'worker-flash-sale-scheduler',
    apiCategory: 'flash_sale',
    triggeredBy: TRIGGERED_BY,
  }) as { response?: { flash_sale_list?: Array<{ timeslot_id: number; flash_sale_id: number; type: number }> } };

  const list = result?.response?.flash_sale_list || [];
  const existing = list.find(fs => fs.timeslot_id === timeslotId && (fs.type === 1 || fs.type === 2));
  return existing ? { exists: true, flashSaleId: existing.flash_sale_id } : { exists: false };
}

function parseFlashSaleItems(
  result: { response?: { item_info?: FlashSaleItem[]; models?: FlashSaleModel[] }; error?: string; message?: string }
): Array<Record<string, unknown>> {
  if (result.error) return [];

  const itemInfoList = result?.response?.item_info || [];
  const modelsList = result?.response?.models || [];

  const itemsWithModels = itemInfoList.map(item => {
    const itemModels = modelsList.filter(m => m.item_id === item.item_id);
    return { ...item, models: itemModels.length > 0 ? itemModels : undefined };
  });

  const enabledItems = itemsWithModels.filter(item => item.status === 1);
  const items: Array<Record<string, unknown>> = [];

  for (const item of enabledItems) {
    const enabledModels = item.models?.filter(m => m.status === 1) || [];
    const isNonVariantWithModel = enabledModels.length === 1 && enabledModels[0].model_id === 0;

    if (isNonVariantWithModel) {
      const model = enabledModels[0];
      if (!model.input_promotion_price || model.input_promotion_price <= 0) continue;
      items.push({
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        item_input_promo_price: model.input_promotion_price,
        item_stock: Math.max(model.campaign_stock || 1, 1),
      });
      continue;
    }

    if (enabledModels.length === 0 && item.input_promotion_price && item.input_promotion_price > 0) {
      items.push({
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        item_input_promo_price: item.input_promotion_price,
        item_stock: Math.max(item.campaign_stock || 1, 1),
      });
      continue;
    }

    if (enabledModels.length === 0) continue;

    const modelData = enabledModels.map(m => ({
      model_id: m.model_id,
      input_promo_price: m.input_promotion_price || 0,
      stock: Math.max(m.campaign_stock || 1, 1),
    }));
    if (modelData.length > 0 && modelData.every(m => m.input_promo_price > 0)) {
      items.push({
        item_id: item.item_id,
        purchase_limit: item.purchase_limit || 0,
        models: modelData,
      });
    }
  }

  return items;
}

async function getItemsFromSuccessfulHistory(shopId: number): Promise<Array<Record<string, unknown>>> {
  const { data } = await supabase
    .from('apishopee_flash_sale_auto_history')
    .select('id, flash_sale_id, items_data, items_count, executed_at')
    .eq('shop_id', shopId)
    .eq('status', 'success')
    .not('items_data', 'is', null)
    .order('executed_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.items_data && Array.isArray(data.items_data) && data.items_data.length > 0) {
    console.log(`[FS-SCHEDULER] Found ${data.items_data.length} items from history (FS #${data.flash_sale_id})`);
    return data.items_data as Array<Record<string, unknown>>;
  }
  return [];
}

async function getTemplateItems(
  credentials: PartnerCredentials,
  shopId: number,
  token: ShopToken
): Promise<Array<Record<string, unknown>>> {
  // Try DB candidates first — only upcoming (type=1) and running (type=2)
  const { data: candidates } = await supabase
    .from('apishopee_flash_sale_data')
    .select('flash_sale_id, type, item_count')
    .eq('shop_id', shopId)
    .gt('item_count', 0)
    .in('type', [1, 2])
    .order('type', { ascending: true })
    .order('start_time', { ascending: false })
    .limit(5);

  for (const fs of candidates || []) {
    const result = await callShopeeApi({
      supabase, credentials,
      path: '/api/v2/shop_flash_sale/get_shop_flash_sale_items',
      method: 'GET', shopId, token,
      extraParams: { flash_sale_id: fs.flash_sale_id, offset: 0, limit: 100 },
      edgeFunction: 'worker-flash-sale-scheduler',
      apiCategory: 'flash_sale',
      triggeredBy: TRIGGERED_BY,
    }) as { response?: { item_info?: FlashSaleItem[]; models?: FlashSaleModel[] }; error?: string; message?: string };

    if (result.error === 'shop_flash_sale_not_exist' || result.error === 'shop_flash_sale_is_not_enabled_or_upcoming') {
      continue;
    }

    const items = parseFlashSaleItems(result);
    if (items.length > 0) return items;
  }

  // Fallback 1: successful history
  const historyItems = await getItemsFromSuccessfulHistory(shopId);
  if (historyItems.length > 0) return historyItems;

  // Fallback 2: live Shopee API
  const liveResult = await callShopeeApi({
    supabase, credentials,
    path: '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
    method: 'GET', shopId, token,
    extraParams: { type: 0, offset: 0, limit: 50 },
    edgeFunction: 'worker-flash-sale-scheduler',
    apiCategory: 'flash_sale',
    triggeredBy: TRIGGERED_BY,
  }) as { response?: { flash_sale_list?: Array<{ flash_sale_id: number; type: number; item_count: number }> } };

  const liveList = (liveResult?.response?.flash_sale_list || [])
    .filter(fs => (fs.type === 1 || fs.type === 2) && fs.item_count > 0)
    .sort((a, b) => a.type - b.type);

  for (const fs of liveList) {
    const itemResult = await callShopeeApi({
      supabase, credentials,
      path: '/api/v2/shop_flash_sale/get_shop_flash_sale_items',
      method: 'GET', shopId, token,
      extraParams: { flash_sale_id: fs.flash_sale_id, offset: 0, limit: 100 },
      edgeFunction: 'worker-flash-sale-scheduler',
      apiCategory: 'flash_sale',
      triggeredBy: TRIGGERED_BY,
    }) as { response?: { item_info?: FlashSaleItem[]; models?: FlashSaleModel[] }; error?: string; message?: string };

    if (itemResult.error) continue;
    const items = parseFlashSaleItems(itemResult);
    if (items.length > 0) return items;
  }

  return [];
}

// ==================== PROCESS JOB ====================

async function processJob(job: ScheduledJob): Promise<{ success: boolean; message: string; flashSaleId?: number }> {
  console.log(`[FS-SCHEDULER] Processing job ${job.id} shop=${job.shop_id} timeslot=${job.timeslot_id}`);

  try {
    // Skip if timeslot already ended
    const nowUnix = Math.floor(Date.now() / 1000);
    if (job.slot_end_time && nowUnix >= job.slot_end_time) {
      const msg = `Timeslot ended (${new Date(job.slot_end_time * 1000).toLocaleString('vi-VN')})`;
      await supabase.from('apishopee_flash_sale_auto_history').update({
        status: 'error', error_message: msg,
        executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      return { success: false, message: msg };
    }

    // Mark as processing
    await supabase.from('apishopee_flash_sale_auto_history')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    const credentials = await getPartnerCredentials(supabase, job.shop_id);
    const token = await getShopToken(supabase, job.shop_id);

    // 1. Check if timeslot already has FS
    const { exists, flashSaleId: existingFsId } = await checkTimeslotHasFlashSale(
      credentials, job.shop_id, token, job.timeslot_id
    );

    if (exists) {
      const msg = `Timeslot already has Flash Sale #${existingFsId}`;
      await supabase.from('apishopee_flash_sale_auto_history').update({
        status: 'error', error_message: msg, flash_sale_id: existingFsId,
        executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      return { success: false, message: msg, flashSaleId: existingFsId };
    }

    // 2. Get template items
    let itemsToAdd: Array<Record<string, unknown>> = [];
    if (job.items_data?.length) {
      itemsToAdd = job.items_data;
    } else {
      itemsToAdd = await getTemplateItems(credentials, job.shop_id, token);
    }

    if (itemsToAdd.length === 0) {
      const msg = 'No template items found for Flash Sale';
      await supabase.from('apishopee_flash_sale_auto_history').update({
        status: 'error', error_message: msg,
        executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      return { success: false, message: msg };
    }

    // 3. Create Flash Sale
    const createResult = await callShopeeApi({
      supabase, credentials,
      path: '/api/v2/shop_flash_sale/create_shop_flash_sale',
      method: 'POST', shopId: job.shop_id, token,
      body: { timeslot_id: job.timeslot_id },
      edgeFunction: 'worker-flash-sale-scheduler',
      apiCategory: 'flash_sale',
      triggeredBy: TRIGGERED_BY,
    }) as { response?: { flash_sale_id?: number }; error?: string; message?: string };

    if (createResult.error || !createResult.response?.flash_sale_id) {
      const errorMsg = createResult.message || createResult.error || 'Cannot create Flash Sale';
      const retryCount = job.retry_count || 0;
      const canRetry = isTransientError(errorMsg) && retryCount < MAX_RETRY_COUNT;

      if (canRetry) {
        const retryAt = new Date(Date.now() + getRetryDelayMinutes(retryCount) * 60_000).toISOString();
        await supabase.from('apishopee_flash_sale_auto_history').update({
          status: 'retry', retry_count: retryCount + 1, scheduled_at: retryAt,
          error_message: `Retry ${retryCount + 1}/${MAX_RETRY_COUNT}: ${errorMsg}`,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id);
        return { success: false, message: `Retry scheduled: ${errorMsg}` };
      }

      await supabase.from('apishopee_flash_sale_auto_history').update({
        status: 'error', error_message: errorMsg,
        executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      await sendFailureAlert(job, errorMsg);
      return { success: false, message: errorMsg };
    }

    const newFsId = createResult.response.flash_sale_id;
    console.log(`[FS-SCHEDULER] Created Flash Sale #${newFsId}`);

    // 4. Add items to Flash Sale
    const addResult = await callShopeeApi({
      supabase, credentials,
      path: '/api/v2/shop_flash_sale/add_shop_flash_sale_items',
      method: 'POST', shopId: job.shop_id, token,
      body: { flash_sale_id: newFsId, items: itemsToAdd },
      edgeFunction: 'worker-flash-sale-scheduler',
      apiCategory: 'flash_sale',
      triggeredBy: TRIGGERED_BY,
    }) as { error?: string; message?: string; response?: {
      success_list?: unknown[]; fail_list?: unknown[];
      failed_items?: Array<{ item_id: number; model_id?: number; err_msg?: string }>;
    } };

    let message = `Created Flash Sale #${newFsId}`;
    let finalStatus: 'success' | 'partial' | 'error' = 'success';
    let addedCount = itemsToAdd.length;

    if (addResult.error && addResult.error !== '') {
      message += ` (Add items error: ${addResult.message || addResult.error})`;
      finalStatus = 'partial';
      addedCount = 0;
    } else {
      const failedItems = addResult.response?.failed_items || [];
      const failList = addResult.response?.fail_list || [];
      const successList = addResult.response?.success_list || [];

      if (failedItems.length > 0) {
        const failedItemIds = [...new Set(failedItems.map(f => f.item_id))];
        if (failedItemIds.length >= itemsToAdd.length) {
          finalStatus = 'partial';
          addedCount = 0;
        } else {
          addedCount = itemsToAdd.length - failedItemIds.length;
        }
        const reasons = failedItems.slice(0, 5).map(f => `item ${f.item_id}: ${f.err_msg || 'unknown'}`).join('; ');
        message = `FS #${newFsId}: ${addedCount}/${itemsToAdd.length} items OK (${reasons})`;
      } else if (failList.length > 0) {
        addedCount = successList.length;
        finalStatus = successList.length === 0 ? 'error' : 'partial';
        message = `FS #${newFsId}: ${successList.length}/${itemsToAdd.length} items added`;
      } else {
        addedCount = successList.length > 0 ? successList.length : itemsToAdd.length;
        message = `Created Flash Sale #${newFsId} with ${addedCount} items`;
      }
    }

    // 5. Update job status
    await supabase.from('apishopee_flash_sale_auto_history').update({
      status: finalStatus, flash_sale_id: newFsId, items_count: addedCount,
      items_data: itemsToAdd,
      error_message: finalStatus !== 'success' ? message : null,
      executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    if (finalStatus === 'partial' || finalStatus === 'error') {
      await sendFailureAlert(job, message);
    }

    return { success: finalStatus === 'success', message, flashSaleId: newFsId };

  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`[FS-SCHEDULER] Job ${job.id} failed:`, errorMsg);

    const retryCount = job.retry_count || 0;
    if (isTransientError(errorMsg) && retryCount < MAX_RETRY_COUNT) {
      const retryAt = new Date(Date.now() + getRetryDelayMinutes(retryCount) * 60_000).toISOString();
      await supabase.from('apishopee_flash_sale_auto_history').update({
        status: 'retry', retry_count: retryCount + 1, scheduled_at: retryAt,
        error_message: `Retry ${retryCount + 1}/${MAX_RETRY_COUNT}: ${errorMsg}`,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      return { success: false, message: `Retry scheduled: ${errorMsg}` };
    }

    await supabase.from('apishopee_flash_sale_auto_history').update({
      status: 'error', error_message: errorMsg,
      executed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', job.id);
    await sendFailureAlert(job, errorMsg);
    return { success: false, message: errorMsg };
  }
}

// ==================== SYNC AFTER SUCCESS ====================

async function syncFlashSaleDataForShop(
  credentials: PartnerCredentials,
  shopId: number,
  token: ShopToken,
  userId: string
): Promise<number> {
  const result = await callShopeeApi({
    supabase, credentials,
    path: '/api/v2/shop_flash_sale/get_shop_flash_sale_list',
    method: 'GET', shopId, token,
    extraParams: { type: 0, offset: 0, limit: 50 },
    edgeFunction: 'worker-flash-sale-scheduler',
    apiCategory: 'flash_sale',
    triggeredBy: TRIGGERED_BY,
  }) as { response?: { flash_sale_list?: Array<Record<string, unknown>> }; error?: string };

  if (result.error || !result.response?.flash_sale_list) return 0;

  const list = result.response.flash_sale_list;
  const syncedAt = new Date().toISOString();

  const upsertData = list.map(sale => ({
    shop_id: shopId, user_id: null, synced_by: userId,
    flash_sale_id: sale.flash_sale_id, timeslot_id: sale.timeslot_id,
    status: sale.status, start_time: sale.start_time, end_time: sale.end_time,
    enabled_item_count: sale.enabled_item_count || 0, item_count: sale.item_count || 0,
    type: sale.type, remindme_count: sale.remindme_count || 0,
    click_count: sale.click_count || 0, raw_response: sale, synced_at: syncedAt,
  }));

  await supabase.from('apishopee_flash_sale_data')
    .upsert(upsertData, { onConflict: 'shop_id,flash_sale_id' });

  await supabase.from('apishopee_sync_status')
    .upsert({ shop_id: shopId, user_id: userId, flash_sales_synced_at: syncedAt, updated_at: syncedAt },
      { onConflict: 'shop_id,user_id' });

  return list.length;
}

// ==================== MAIN ENTRY POINT ====================

/** Running flag to prevent overlapping executions */
let _isRunning = false;

/** Check if scheduler is currently running (used by graceful shutdown) */
export function isSchedulerRunning(): boolean {
  return _isRunning;
}

export async function runFlashSaleScheduler(): Promise<void> {
  if (_isRunning) {
    console.log('[FS-SCHEDULER] Previous run still active, skipping');
    return;
  }
  _isRunning = true;

  try {
    const now = new Date().toISOString();
    console.log(`[FS-SCHEDULER] Running at ${now}`);

    // Find pending + retry jobs
    const { data: pendingJobs, error: queryError } = await supabase
      .from('apishopee_flash_sale_auto_history')
      .select('id, shop_id, user_id, timeslot_id, slot_start_time, slot_end_time, items_count, scheduled_at, retry_count, items_data')
      .in('status', ['scheduled', 'retry'])
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(200);

    if (queryError) throw new Error(`Query error: ${queryError.message}`);

    if (!pendingJobs?.length) {
      console.log('[FS-SCHEDULER] No pending jobs');
      return;
    }

    console.log(`[FS-SCHEDULER] Found ${pendingJobs.length} pending jobs`);

    // Optimistic lock all jobs to 'processing'
    const jobIds = pendingJobs.map(j => j.id);
    await supabase.from('apishopee_flash_sale_auto_history')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .in('id', jobIds);

    // Group by shop_id
    const jobsByShop = new Map<number, ScheduledJob[]>();
    for (const job of pendingJobs) {
      const shopId = job.shop_id as number;
      if (!jobsByShop.has(shopId)) jobsByShop.set(shopId, []);
      jobsByShop.get(shopId)!.push(job as unknown as ScheduledJob);
    }

    console.log(`[FS-SCHEDULER] ${pendingJobs.length} jobs across ${jobsByShop.size} shops`);

    // Process shops in batches of 5 (parallel between shops, sequential within shop)
    const shopEntries = Array.from(jobsByShop.entries());
    const results: Array<{ jobId: string; shopId: number; success: boolean; message: string }> = [];

    for (let i = 0; i < shopEntries.length; i += MAX_CONCURRENT_SHOPS) {
      const batch = shopEntries.slice(i, i + MAX_CONCURRENT_SHOPS);

      const batchResults = await Promise.allSettled(
        batch.map(async ([shopId, jobs]) => {
          const shopResults = [];
          for (const job of jobs) {
            const result = await processJob(job);
            shopResults.push({ jobId: job.id, shopId, ...result });
            if (jobs.length > 1) await delay(500);
          }
          return shopResults;
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') results.push(...result.value);
      }

      // Delay between batches for rate limiting
      if (i + MAX_CONCURRENT_SHOPS < shopEntries.length) {
        await delay(2000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    console.log(`[FS-SCHEDULER] Done: ${successCount} success, ${errorCount} errors`);

    // Sync flash sale data for successful shops
    if (successCount > 0) {
      const successShopIds = [...new Set(results.filter(r => r.success).map(r => r.shopId))];
      for (const shopId of successShopIds) {
        try {
          const credentials = await getPartnerCredentials(supabase, shopId);
          const token = await getShopToken(supabase, shopId);
          const job = pendingJobs.find(j => j.shop_id === shopId);
          await syncFlashSaleDataForShop(credentials, shopId, token, (job?.user_id as string) || '');
        } catch (err) {
          console.error(`[FS-SCHEDULER] Post-sync failed for shop ${shopId}:`, (err as Error).message);
        }
      }
    }
  } catch (error) {
    console.error('[FS-SCHEDULER] Fatal error:', (error as Error).message);
  } finally {
    _isRunning = false;
  }
}
