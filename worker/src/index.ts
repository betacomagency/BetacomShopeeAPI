/**
 * Shopee Worker — Main Entry Point
 *
 * Persistent Node.js process running on EC2, managed by PM2.
 * Replaces pg_cron + Edge Functions for batch processing 294+ shops.
 *
 * Phase 1: Flash Sale jobs (scheduler + sync)
 * Phase 2: Token refresh + all sync jobs (TODO)
 * Phase 3: Ads jobs (TODO)
 */
import cron from 'node-cron';
import http from 'http';
import { config } from './config';
import { runFlashSaleScheduler } from './jobs/flash-sale-scheduler';
import { runFlashSaleSync } from './jobs/flash-sale-sync';

// ==================== CRON SCHEDULES ====================

// Flash sale scheduler — every 2 minutes (URGENT: was timing out on Edge Functions)
cron.schedule('*/2 * * * *', async () => {
  console.log(`[CRON] Flash sale scheduler triggered at ${new Date().toISOString()}`);
  try {
    await runFlashSaleScheduler();
  } catch (err) {
    console.error('[CRON] Flash sale scheduler error:', (err as Error).message);
  }
});

// Flash sale sync — every 30 minutes (at :10 and :40 to avoid overlap with scheduler)
cron.schedule('10,40 * * * *', async () => {
  console.log(`[CRON] Flash sale sync triggered at ${new Date().toISOString()}`);
  try {
    await runFlashSaleSync();
  } catch (err) {
    console.error('[CRON] Flash sale sync error:', (err as Error).message);
  }
});

// TODO Phase 2: Token refresh, orders, reviews, auto-reply, products, escrow
// TODO Phase 3: Ads enqueue, queue processor, backfill, budget scheduler, cleanup

// ==================== HEALTH CHECK ====================

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      env: config.nodeEnv,
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(3456, () => {
  console.log('[WORKER] Health check listening on port 3456');
});

// ==================== STARTUP ====================

console.log('='.repeat(60));
console.log('[WORKER] Shopee Worker started');
console.log(`[WORKER] Environment: ${config.nodeEnv}`);
console.log(`[WORKER] Supabase: ${config.supabaseUrl}`);
console.log(`[WORKER] Shopee API: ${config.shopeeBaseUrl}`);
console.log('[WORKER] Registered cron jobs:');
console.log('  - Flash Sale Scheduler: */2 * * * *');
console.log('  - Flash Sale Sync:      10,40 * * * *');
console.log('='.repeat(60));
