/**
 * Tests for pure utility functions extracted from hooks
 * Avoids React rendering context — tests logic only
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dateRangeToDays } from '@/hooks/useApiCallStats';
import { getDateFilter } from '@/hooks/usePushLogs';
import { isRateLimit } from '@/hooks/useShopPerformance';
import { isDataStale } from '@/hooks/useSyncData';

// ── dateRangeToDays ──────────────────────────────────────────────────────────

describe('dateRangeToDays', () => {
  it('returns 1 for "1h"', () => {
    expect(dateRangeToDays('1h')).toBe(1);
  });

  it('returns 1 for "24h"', () => {
    expect(dateRangeToDays('24h')).toBe(1);
  });

  it('returns 7 for "7d"', () => {
    expect(dateRangeToDays('7d')).toBe(7);
  });

  it('returns 30 for "30d"', () => {
    expect(dateRangeToDays('30d')).toBe(30);
  });

  it('returns 365 for "all"', () => {
    expect(dateRangeToDays('all')).toBe(365);
  });

  it('returns 7 for undefined (default)', () => {
    expect(dateRangeToDays(undefined)).toBe(7);
  });

  it('returns 7 for unknown range', () => {
    expect(dateRangeToDays('unknown')).toBe(7);
  });
});

// ── getDateFilter ────────────────────────────────────────────────────────────

describe('getDateFilter', () => {
  const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for "all"', () => {
    expect(getDateFilter('all')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getDateFilter(undefined)).toBeNull();
  });

  it('returns ISO string 1h ago for "1h"', () => {
    const result = getDateFilter('1h');
    const expected = new Date(FIXED_NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('returns ISO string 24h ago for "24h"', () => {
    const result = getDateFilter('24h');
    const expected = new Date(FIXED_NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('returns ISO string 7 days ago for "7d"', () => {
    const result = getDateFilter('7d');
    const expected = new Date(FIXED_NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('returns ISO string 30 days ago for "30d"', () => {
    const result = getDateFilter('30d');
    const expected = new Date(FIXED_NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(result).toBe(expected);
  });

  it('returns null for unknown range', () => {
    expect(getDateFilter('90d')).toBeNull();
  });
});

// ── isRateLimit ──────────────────────────────────────────────────────────────

describe('isRateLimit', () => {
  it('matches "rate limit" (with space)', () => {
    expect(isRateLimit('API rate limit exceeded')).toBe(true);
  });

  it('matches "rate-limit" (with hyphen)', () => {
    expect(isRateLimit('rate-limit reached')).toBe(true);
  });

  it('matches "ratelimit" (no separator)', () => {
    expect(isRateLimit('ratelimit error')).toBe(true);
  });

  it('matches "too many requests"', () => {
    expect(isRateLimit('too many requests')).toBe(true);
  });

  it('matches "toomany" (no space)', () => {
    expect(isRateLimit('toomany calls')).toBe(true);
  });

  it('matches "429" status code in message', () => {
    expect(isRateLimit('HTTP 429 error')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isRateLimit('Rate Limit Exceeded')).toBe(true);
    expect(isRateLimit('TOO MANY REQUESTS')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isRateLimit('Network timeout')).toBe(false);
    expect(isRateLimit('Invalid token')).toBe(false);
    expect(isRateLimit('Not found')).toBe(false);
    expect(isRateLimit('')).toBe(false);
  });
});

// ── isDataStale ──────────────────────────────────────────────────────────────

describe('isDataStale', () => {
  const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when lastSyncedAt is null', () => {
    expect(isDataStale(null, 30)).toBe(true);
  });

  it('returns true when data is older than staleMinutes', () => {
    const oldSync = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000).toISOString();
    expect(isDataStale(oldSync, 30)).toBe(true);
  });

  it('returns false when data is within staleMinutes', () => {
    const recentSync = new Date(FIXED_NOW.getTime() - 10 * 60 * 1000).toISOString();
    expect(isDataStale(recentSync, 30)).toBe(false);
  });

  it('returns false when synced exactly at the boundary minus 1ms', () => {
    const justFresh = new Date(FIXED_NOW.getTime() - 29 * 60 * 1000).toISOString();
    expect(isDataStale(justFresh, 30)).toBe(false);
  });

  it('returns true when synced exactly at staleMinutes boundary plus 1ms', () => {
    const justStale = new Date(FIXED_NOW.getTime() - (30 * 60 * 1000 + 1)).toISOString();
    expect(isDataStale(justStale, 30)).toBe(true);
  });

  it('returns false for very recent sync (1 second ago)', () => {
    const justSynced = new Date(FIXED_NOW.getTime() - 1000).toISOString();
    expect(isDataStale(justSynced, 30)).toBe(false);
  });

  it('uses custom staleMinutes threshold', () => {
    const fiveMinutesAgo = new Date(FIXED_NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(isDataStale(fiveMinutesAgo, 3)).toBe(true);
    expect(isDataStale(fiveMinutesAgo, 10)).toBe(false);
  });
});
