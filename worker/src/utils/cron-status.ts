/**
 * Cron job status tracking for monitoring.
 * Each job reports its last run time, status, and duration.
 * Used by /health endpoint and heartbeat logger.
 */

export interface CronJobStatus {
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | 'running' | null;
  lastDurationMs: number | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
}

/** Registry of all cron job statuses */
const cronStatuses: Record<string, CronJobStatus> = {};

/** Initialize a cron job entry */
export function registerCronJob(name: string): void {
  cronStatuses[name] = {
    lastRun: null,
    lastStatus: null,
    lastDurationMs: null,
    lastError: null,
    runCount: 0,
    errorCount: 0,
  };
}

/** Mark a cron job as started (running) */
export function markCronStart(name: string): number {
  if (!cronStatuses[name]) registerCronJob(name);
  cronStatuses[name].lastStatus = 'running';
  return Date.now();
}

/** Mark a cron job as completed successfully */
export function markCronSuccess(name: string, startTime: number): void {
  if (!cronStatuses[name]) registerCronJob(name);
  const status = cronStatuses[name];
  status.lastRun = new Date().toISOString();
  status.lastStatus = 'success';
  status.lastDurationMs = Date.now() - startTime;
  status.lastError = null;
  status.runCount++;
}

/** Mark a cron job as failed */
export function markCronFailed(name: string, startTime: number, error: string): void {
  if (!cronStatuses[name]) registerCronJob(name);
  const status = cronStatuses[name];
  status.lastRun = new Date().toISOString();
  status.lastStatus = 'failed';
  status.lastDurationMs = Date.now() - startTime;
  status.lastError = error;
  status.runCount++;
  status.errorCount++;
}

/** Get all cron job statuses (for /health and heartbeat) */
export function getAllCronStatuses(): Record<string, CronJobStatus> {
  return { ...cronStatuses };
}
