/**
 * Unit Tests: Flash Sale Time Utilities
 * Covers: getTimeSinceSync, formatTimestamp, formatTimeRange,
 *         calculateDynamicType, withDynamicType
 */

import { vi } from 'vitest';
import {
  getTimeSinceSync,
  formatTimestamp,
  formatTimeRange,
  calculateDynamicType,
  withDynamicType,
} from '@/lib/shopee/flash-sale/utils';
import { createMockFlashSale } from '@/test/factories';

const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');
const FIXED_NOW_MS = FIXED_NOW.getTime();
const FIXED_NOW_S = Math.floor(FIXED_NOW_MS / 1000);

describe('getTimeSinceSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Chưa đồng bộ" for null', () => {
    expect(getTimeSinceSync(null)).toBe('Chưa đồng bộ');
  });

  it('returns "Vừa xong" for time less than 1 minute ago', () => {
    const justNow = new Date(FIXED_NOW_MS - 30 * 1000).toISOString();
    expect(getTimeSinceSync(justNow)).toBe('Vừa xong');
  });

  it('returns "Vừa xong" for time exactly 0 seconds ago', () => {
    expect(getTimeSinceSync(FIXED_NOW.toISOString())).toBe('Vừa xong');
  });

  it('returns "X phút trước" for 30 minutes ago', () => {
    const thirtyMinAgo = new Date(FIXED_NOW_MS - 30 * 60 * 1000).toISOString();
    expect(getTimeSinceSync(thirtyMinAgo)).toBe('30 phút trước');
  });

  it('returns "X phút trước" for 59 minutes ago', () => {
    const fiftyNineMinAgo = new Date(FIXED_NOW_MS - 59 * 60 * 1000).toISOString();
    expect(getTimeSinceSync(fiftyNineMinAgo)).toBe('59 phút trước');
  });

  it('returns "X giờ trước" for 2 hours ago', () => {
    const twoHoursAgo = new Date(FIXED_NOW_MS - 2 * 60 * 60 * 1000).toISOString();
    expect(getTimeSinceSync(twoHoursAgo)).toBe('2 giờ trước');
  });

  it('returns "X giờ trước" for 23 hours ago', () => {
    const twentyThreeHoursAgo = new Date(FIXED_NOW_MS - 23 * 60 * 60 * 1000).toISOString();
    expect(getTimeSinceSync(twentyThreeHoursAgo)).toBe('23 giờ trước');
  });

  it('returns "X ngày trước" for 3 days ago', () => {
    const threeDaysAgo = new Date(FIXED_NOW_MS - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(getTimeSinceSync(threeDaysAgo)).toBe('3 ngày trước');
  });
});

describe('formatTimestamp', () => {
  it('returns a non-empty string for a valid unix timestamp', () => {
    const result = formatTimestamp(FIXED_NOW_S);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains year digits from the timestamp', () => {
    // 2024-06-15T12:00:00Z in unix seconds
    const result = formatTimestamp(FIXED_NOW_S);
    expect(result).toContain('2024');
  });

  it('contains month and day parts', () => {
    // Timestamp for 2024-06-15 — vi-VN format includes 15 and 06
    const result = formatTimestamp(FIXED_NOW_S);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/06/);
  });

  it('returns different strings for different timestamps', () => {
    const t1 = formatTimestamp(1700000000);
    const t2 = formatTimestamp(1800000000);
    expect(t1).not.toBe(t2);
  });
});

describe('formatTimeRange', () => {
  it('returns a string containing a dash separator', () => {
    const start = FIXED_NOW_S;
    const end = FIXED_NOW_S + 3600;
    const result = formatTimeRange(start, end);
    expect(result).toContain('-');
  });

  it('result is non-empty', () => {
    const result = formatTimeRange(FIXED_NOW_S, FIXED_NOW_S + 7200);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes start date parts and end time parts', () => {
    // start: 2024-06-15T12:00Z, end: 2024-06-15T14:00Z
    const result = formatTimeRange(FIXED_NOW_S, FIXED_NOW_S + 7200);
    // Should contain the date of start (15/06)
    expect(result).toMatch(/15/);
  });
});

describe('calculateDynamicType', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 1 (upcoming) when now < startTime', () => {
    const futureStart = FIXED_NOW_S + 3600;
    const futureEnd = FIXED_NOW_S + 7200;
    expect(calculateDynamicType(futureStart, futureEnd)).toBe(1);
  });

  it('returns 2 (ongoing) when startTime <= now <= endTime', () => {
    const pastStart = FIXED_NOW_S - 3600;
    const futureEnd = FIXED_NOW_S + 3600;
    expect(calculateDynamicType(pastStart, futureEnd)).toBe(2);
  });

  it('returns 2 (ongoing) when now exactly equals startTime', () => {
    const start = FIXED_NOW_S;
    const end = FIXED_NOW_S + 3600;
    expect(calculateDynamicType(start, end)).toBe(2);
  });

  it('returns 3 (expired) when now > endTime', () => {
    const pastStart = FIXED_NOW_S - 7200;
    const pastEnd = FIXED_NOW_S - 3600;
    expect(calculateDynamicType(pastStart, pastEnd)).toBe(3);
  });
});

describe('withDynamicType', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recalculates type to upcoming for future sale', () => {
    const sale = createMockFlashSale({
      start_time: FIXED_NOW_S + 3600,
      end_time: FIXED_NOW_S + 7200,
      type: 3, // stored as expired, but should be recalculated
    });
    const result = withDynamicType(sale);
    expect(result.type).toBe(1);
  });

  it('recalculates type to ongoing for current sale', () => {
    const sale = createMockFlashSale({
      start_time: FIXED_NOW_S - 1800,
      end_time: FIXED_NOW_S + 1800,
      type: 1,
    });
    const result = withDynamicType(sale);
    expect(result.type).toBe(2);
  });

  it('recalculates type to expired for past sale', () => {
    const sale = createMockFlashSale({
      start_time: FIXED_NOW_S - 7200,
      end_time: FIXED_NOW_S - 3600,
      type: 2,
    });
    const result = withDynamicType(sale);
    expect(result.type).toBe(3);
  });

  it('does not mutate original sale object', () => {
    const sale = createMockFlashSale({
      start_time: FIXED_NOW_S - 7200,
      end_time: FIXED_NOW_S - 3600,
      type: 2,
    });
    const originalType = sale.type;
    withDynamicType(sale);
    expect(sale.type).toBe(originalType);
  });

  it('preserves all other fields of the sale', () => {
    const sale = createMockFlashSale({
      start_time: FIXED_NOW_S + 3600,
      end_time: FIXED_NOW_S + 7200,
    });
    const result = withDynamicType(sale);
    expect(result.id).toBe(sale.id);
    expect(result.flash_sale_id).toBe(sale.flash_sale_id);
    expect(result.shop_id).toBe(sale.shop_id);
  });
});
