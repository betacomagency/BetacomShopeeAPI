/**
 * Tests for activity-logger.ts — logActivity, updateActivityStatus, ActivityTracker, logCompletedActivity
 *
 * Hoisting rule: vi.mock factory runs before any top-level variable initialisation.
 * Solution: build the entire mock object inside the factory; expose it on the
 * module shape so tests can grab it via the mocked import.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// All vi.fn() instances must live INSIDE the factory – they are created fresh
// each test run and the factory is hoisted above every import/const.
vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn();
  return {
    supabase: { from: mockFrom },
    // expose on the module so tests can import and cast it
    __mockFrom: mockFrom,
  };
});

// Import after mock registration so we get the mocked version
import * as SupabaseMod from '@/lib/supabase';
import {
  logActivity,
  updateActivityStatus,
  logCompletedActivity,
  ActivityTracker,
} from '@/lib/activity-logger';

// Pull the shared mock function out of the mocked module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = (SupabaseMod as any).__mockFrom as ReturnType<typeof vi.fn>;

// ── Chain builder helpers ─────────────────────────────────────────────────────

/** Simulates: supabase.from(t).insert(row).select('id').single() → { data, error } */
function makeInsertChain(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert, select, single };
}

/** Simulates: supabase.from(t).update(row).eq('id', id) → { data: null, error } */
function makeUpdateChain(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data: null, error });
  const update = vi.fn().mockReturnValue({ eq });
  return { update, eq };
}

const BASE_PARAMS = {
  userId: 'user-1',
  actionType: 'flash_sale_sync',
  actionCategory: 'flash_sale' as const,
  actionDescription: 'Sync flash sales',
};

// ── logActivity ───────────────────────────────────────────────────────────────

describe('logActivity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a record and returns success with id', async () => {
    const chain = makeInsertChain({ id: 'log-abc' });
    mockFrom.mockReturnValue(chain);

    const result = await logActivity(BASE_PARAMS);

    expect(result.success).toBe(true);
    expect(result.id).toBe('log-abc');
    expect(mockFrom).toHaveBeenCalledWith('system_activity_logs');
    expect(chain.insert).toHaveBeenCalled();
  });

  it('defaults status to "pending" when not provided', async () => {
    const chain = makeInsertChain({ id: 'log-xyz' });
    mockFrom.mockReturnValue(chain);

    await logActivity(BASE_PARAMS);

    expect(chain.insert.mock.calls[0][0].status).toBe('pending');
  });

  it('uses provided status override', async () => {
    const chain = makeInsertChain({ id: 'log-2' });
    mockFrom.mockReturnValue(chain);

    await logActivity({ ...BASE_PARAMS, status: 'success' });

    expect(chain.insert.mock.calls[0][0].status).toBe('success');
  });

  it('returns success:false when DB returns an error', async () => {
    const chain = makeInsertChain(null, { message: 'DB write failed' });
    mockFrom.mockReturnValue(chain);

    const result = await logActivity(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB write failed');
  });

  it('returns success:false when an exception is thrown', async () => {
    mockFrom.mockImplementation(() => { throw new Error('connection error'); });

    const result = await logActivity(BASE_PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toBe('connection error');
  });
});

// ── updateActivityStatus ──────────────────────────────────────────────────────

describe('updateActivityStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates status and returns success', async () => {
    const chain = makeUpdateChain();
    mockFrom.mockReturnValue(chain);

    const result = await updateActivityStatus('log-1', 'success');

    expect(result.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('system_activity_logs');
    expect(chain.update).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'log-1');
  });

  it('auto-sets completed_at for final statuses', async () => {
    const chain = makeUpdateChain();
    mockFrom.mockReturnValue(chain);

    await updateActivityStatus('log-1', 'failed');

    const arg = chain.update.mock.calls[0][0];
    expect(arg.status).toBe('failed');
    expect(arg.completed_at).toBeDefined();
  });

  it('includes errorMessage when provided', async () => {
    const chain = makeUpdateChain();
    mockFrom.mockReturnValue(chain);

    await updateActivityStatus('log-1', 'failed', { errorMessage: 'timeout' });

    expect(chain.update.mock.calls[0][0].error_message).toBe('timeout');
  });

  it('returns success:false on DB error', async () => {
    const chain = makeUpdateChain({ message: 'update failed' });
    mockFrom.mockReturnValue(chain);

    const result = await updateActivityStatus('log-1', 'cancelled');

    expect(result.success).toBe(false);
    expect(result.error).toBe('update failed');
  });
});

// ── ActivityTracker ───────────────────────────────────────────────────────────

describe('ActivityTracker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('start() creates pending log and returns id', async () => {
    const chain = makeInsertChain({ id: 'tracker-1' });
    mockFrom.mockReturnValue(chain);

    const tracker = new ActivityTracker(BASE_PARAMS);
    const id = await tracker.start();

    expect(id).toBe('tracker-1');
    expect(tracker.getLogId()).toBe('tracker-1');
    expect(chain.insert.mock.calls[0][0].status).toBe('pending');
  });

  it('start() returns null when DB insert fails', async () => {
    const chain = makeInsertChain(null, { message: 'insert error' });
    mockFrom.mockReturnValue(chain);

    const tracker = new ActivityTracker(BASE_PARAMS);
    const id = await tracker.start();

    expect(id).toBeNull();
    expect(tracker.getLogId()).toBeNull();
  });

  it('success() updates status and passes responseData', async () => {
    const insertChain = makeInsertChain({ id: 'tracker-2' });
    const updateChain = makeUpdateChain();
    mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(updateChain);

    const tracker = new ActivityTracker(BASE_PARAMS);
    await tracker.start();
    await tracker.success({ items: 5 });

    const arg = updateChain.update.mock.calls[0][0];
    expect(arg.status).toBe('success');
    expect(arg.response_data).toEqual({ items: 5 });
  });

  it('success() is a no-op when start() was never called', async () => {
    const tracker = new ActivityTracker(BASE_PARAMS);
    await tracker.success();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fail() records failed status with error message and code', async () => {
    const insertChain = makeInsertChain({ id: 'tracker-3' });
    const updateChain = makeUpdateChain();
    mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(updateChain);

    const tracker = new ActivityTracker(BASE_PARAMS);
    await tracker.start();
    await tracker.fail('API error', 'ERR_500');

    const arg = updateChain.update.mock.calls[0][0];
    expect(arg.status).toBe('failed');
    expect(arg.error_message).toBe('API error');
    expect(arg.error_code).toBe('ERR_500');
  });

  it('cancel() records cancelled status with reason', async () => {
    const insertChain = makeInsertChain({ id: 'tracker-4' });
    const updateChain = makeUpdateChain();
    mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(updateChain);

    const tracker = new ActivityTracker(BASE_PARAMS);
    await tracker.start();
    await tracker.cancel('user cancelled');

    const arg = updateChain.update.mock.calls[0][0];
    expect(arg.status).toBe('cancelled');
    expect(arg.error_message).toBe('user cancelled');
  });
});

// ── logCompletedActivity ──────────────────────────────────────────────────────

describe('logCompletedActivity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts with provided status', async () => {
    const chain = makeInsertChain({ id: 'completed-1' });
    mockFrom.mockReturnValue(chain);

    const result = await logCompletedActivity({ ...BASE_PARAMS, status: 'success' });

    expect(result.success).toBe(true);
    expect(chain.insert.mock.calls[0][0].status).toBe('success');
  });

  it('sets both started_at and completed_at', async () => {
    const chain = makeInsertChain({ id: 'completed-2' });
    mockFrom.mockReturnValue(chain);

    await logCompletedActivity({ ...BASE_PARAMS, status: 'failed' });

    const arg = chain.insert.mock.calls[0][0];
    expect(arg.started_at).toBeDefined();
    expect(arg.completed_at).toBeDefined();
  });
});
