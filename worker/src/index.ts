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
import { supabase } from './lib/supabase';
import { runFlashSaleScheduler } from './jobs/flash-sale-scheduler';
import { runFlashSaleSync } from './jobs/flash-sale-sync';
import { runTokenRefresh } from './jobs/token-refresh';

// ==================== ERROR HANDLERS ====================

process.on('unhandledRejection', (reason) => {
  console.error('[WORKER] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[WORKER] Uncaught exception:', err.message, err.stack);
  // PM2 will restart the process
  process.exit(1);
});

// ==================== STARTUP CLEANUP ====================

/**
 * Reset stuck 'processing' rows on startup.
 * Handles case where PM2 restarted after a crash mid-job.
 */
async function cleanupStuckJobs(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('apishopee_flash_sale_auto_history')
      .update({
        status: 'scheduled',
        error_message: 'Worker restarted — reset from processing',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'processing')
      .select('id');

    if (error) {
      console.error('[WORKER] Startup cleanup error:', error.message);
      return;
    }
    if (data && data.length > 0) {
      console.log(`[WORKER] Reset ${data.length} stuck processing jobs back to scheduled`);
    }
  } catch (err) {
    console.error('[WORKER] Startup cleanup failed:', (err as Error).message);
  }
}

// Run cleanup before starting cron jobs
cleanupStuckJobs();

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

// Token refresh — every 30 minutes (runs before sync jobs to ensure valid tokens)
cron.schedule('0,30 * * * *', async () => {
  console.log(`[CRON] Token refresh triggered at ${new Date().toISOString()}`);
  try {
    await runTokenRefresh();
  } catch (err) {
    console.error('[CRON] Token refresh error:', (err as Error).message);
  }
});

// TODO Phase 2: orders, products sync
// TODO Phase 3: Ads (future)

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

// ==================== GRACEFUL SHUTDOWN ====================

let isShuttingDown = false;

/** Export for jobs to check if shutdown is in progress */
export function isWorkerShuttingDown(): boolean {
  return isShuttingDown;
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[WORKER] ${signal} received, shutting down gracefully...`);

  // Stop accepting new cron triggers (jobs check isShuttingDown flag)
  // Wait for running jobs to finish (max 30s)
  const maxWait = 30000;
  const start = Date.now();

  // Poll until jobs finish or timeout
  const { isSchedulerRunning } = await import('./jobs/flash-sale-scheduler');
  const { isSyncRunning } = await import('./jobs/flash-sale-sync');
  const { isTokenRefreshRunning } = await import('./jobs/token-refresh');

  while ((isSchedulerRunning() || isSyncRunning() || isTokenRefreshRunning()) && Date.now() - start < maxWait) {
    console.log('[WORKER] Waiting for running jobs to finish...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (Date.now() - start >= maxWait) {
    console.warn('[WORKER] Shutdown timeout — some jobs may not have completed');
  }

  server.close();
  console.log('[WORKER] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==================== STARTUP ====================

console.log('='.repeat(60));
console.log('[WORKER] Shopee Worker started');
console.log(`[WORKER] Environment: ${config.nodeEnv}`);
console.log(`[WORKER] Supabase: ${config.supabaseUrl}`);
console.log(`[WORKER] Shopee API: ${config.shopeeBaseUrl}`);
console.log('[WORKER] Registered cron jobs:');
console.log('  - Flash Sale Scheduler: */2 * * * *');
console.log('  - Flash Sale Sync:      10,40 * * * *');
console.log('  - Token Refresh:        0,30 * * * *');
console.log('='.repeat(60));
