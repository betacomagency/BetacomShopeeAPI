/**
 * Health heartbeat — writes periodic status to health_check_logs table.
 * Runs every 5 minutes via node-cron. Fire-and-forget (never blocks worker).
 */
import cron from 'node-cron';
import { SupabaseClient } from '@supabase/supabase-js';
import { getAllCronStatuses } from './cron-status';

/** Derive worker health status from cron job statuses */
function deriveStatus(): 'healthy' | 'degraded' {
  const crons = getAllCronStatuses();
  for (const status of Object.values(crons)) {
    if (status.lastStatus === 'failed') return 'degraded';
  }
  return 'healthy';
}

/** Write a single heartbeat row to health_check_logs */
async function writeHeartbeat(supabase: SupabaseClient): Promise<void> {
  try {
    const memUsage = process.memoryUsage();
    await supabase.from('health_check_logs').insert({
      component: 'worker',
      status: deriveStatus(),
      metadata: {
        uptime_s: Math.floor(process.uptime()),
        memory_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        memory_rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        crons: getAllCronStatuses(),
      },
    });
  } catch (err) {
    console.error('[HEARTBEAT] Failed to write heartbeat:', (err as Error).message);
  }
}

/** Start heartbeat: immediate write + every 5 minutes */
export function startHeartbeat(supabase: SupabaseClient): void {
  // Initial heartbeat on startup
  writeHeartbeat(supabase);

  // Then every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    writeHeartbeat(supabase);
  });

  console.log('[HEARTBEAT] Heartbeat started (every 5 min)');
}
