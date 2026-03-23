/**
 * Unit Tests: Flash Sale Deduplication and Sort Utilities
 * Covers: deduplicateByTimeslot, sortFlashSalesByStartTime
 */

import {
  deduplicateByTimeslot,
  sortFlashSalesByStartTime,
} from '@/lib/shopee/flash-sale/utils';
import { createMockFlashSale, resetFactoryIds } from '@/test/factories';

beforeEach(() => {
  resetFactoryIds();
});

describe('deduplicateByTimeslot', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateByTimeslot([])).toEqual([]);
  });

  it('returns same length for all-unique timeslots', () => {
    const sales = [
      createMockFlashSale({ timeslot_id: 101 }),
      createMockFlashSale({ timeslot_id: 102 }),
      createMockFlashSale({ timeslot_id: 103 }),
    ];
    expect(deduplicateByTimeslot(sales)).toHaveLength(3);
  });

  it('deduplicates to one entry per timeslot_id', () => {
    const sales = [
      createMockFlashSale({ timeslot_id: 200, status: 1 }),
      createMockFlashSale({ timeslot_id: 200, status: 2 }),
    ];
    const result = deduplicateByTimeslot(sales);
    expect(result).toHaveLength(1);
  });

  it('keeps enabled (status=1) over disabled (status=2) for same timeslot', () => {
    const enabled = createMockFlashSale({ timeslot_id: 300, status: 1, flash_sale_id: 10 });
    const disabled = createMockFlashSale({ timeslot_id: 300, status: 2, flash_sale_id: 11 });
    // disabled inserted first
    const result = deduplicateByTimeslot([disabled, enabled]);
    expect(result[0].status).toBe(1);
  });

  it('keeps enabled over deleted (status=0) for same timeslot', () => {
    const enabled = createMockFlashSale({ timeslot_id: 400, status: 1, flash_sale_id: 20 });
    const deleted = createMockFlashSale({ timeslot_id: 400, status: 0, flash_sale_id: 21 });
    const result = deduplicateByTimeslot([deleted, enabled]);
    expect(result[0].status).toBe(1);
  });

  it('keeps ongoing (type=2) over upcoming (type=1) when status is equal', () => {
    const ongoing = createMockFlashSale({ timeslot_id: 500, status: 1, type: 2, flash_sale_id: 30 });
    const upcoming = createMockFlashSale({ timeslot_id: 500, status: 1, type: 1, flash_sale_id: 31 });
    const result = deduplicateByTimeslot([upcoming, ongoing]);
    expect(result[0].type).toBe(2);
  });

  it('keeps ongoing (type=2) over expired (type=3) when status is equal', () => {
    const ongoing = createMockFlashSale({ timeslot_id: 600, status: 1, type: 2, flash_sale_id: 40 });
    const expired = createMockFlashSale({ timeslot_id: 600, status: 1, type: 3, flash_sale_id: 41 });
    const result = deduplicateByTimeslot([expired, ongoing]);
    expect(result[0].type).toBe(2);
  });

  it('keeps higher flash_sale_id as tiebreaker when status and type are equal', () => {
    const older = createMockFlashSale({ timeslot_id: 700, status: 1, type: 1, flash_sale_id: 50 });
    const newer = createMockFlashSale({ timeslot_id: 700, status: 1, type: 1, flash_sale_id: 99 });
    const result = deduplicateByTimeslot([older, newer]);
    expect(result[0].flash_sale_id).toBe(99);
  });

  it('handles single sale with no duplicates', () => {
    const sale = createMockFlashSale({ timeslot_id: 800 });
    const result = deduplicateByTimeslot([sale]);
    expect(result).toHaveLength(1);
    expect(result[0].timeslot_id).toBe(800);
  });

  it('handles multiple distinct timeslots with no duplicates unchanged', () => {
    const sales = [
      createMockFlashSale({ timeslot_id: 901, status: 1, type: 1 }),
      createMockFlashSale({ timeslot_id: 902, status: 2, type: 3 }),
    ];
    const result = deduplicateByTimeslot(sales);
    expect(result).toHaveLength(2);
    const ids = result.map((s) => s.timeslot_id).sort();
    expect(ids).toEqual([901, 902]);
  });

  it('does not mutate the original array', () => {
    const sales = [
      createMockFlashSale({ timeslot_id: 1001, status: 1 }),
      createMockFlashSale({ timeslot_id: 1001, status: 2 }),
    ];
    const originalLength = sales.length;
    deduplicateByTimeslot(sales);
    expect(sales).toHaveLength(originalLength);
  });
});

describe('sortFlashSalesByStartTime', () => {
  const now = Math.floor(Date.now() / 1000);

  it('sorts ascending when ascending=true', () => {
    const sales = [
      createMockFlashSale({ start_time: now + 3000 }),
      createMockFlashSale({ start_time: now + 1000 }),
      createMockFlashSale({ start_time: now + 2000 }),
    ];
    const result = sortFlashSalesByStartTime(sales, true);
    expect(result[0].start_time).toBe(now + 1000);
    expect(result[1].start_time).toBe(now + 2000);
    expect(result[2].start_time).toBe(now + 3000);
  });

  it('sorts descending when ascending=false (default)', () => {
    const sales = [
      createMockFlashSale({ start_time: now + 1000 }),
      createMockFlashSale({ start_time: now + 3000 }),
      createMockFlashSale({ start_time: now + 2000 }),
    ];
    const result = sortFlashSalesByStartTime(sales, false);
    expect(result[0].start_time).toBe(now + 3000);
    expect(result[1].start_time).toBe(now + 2000);
    expect(result[2].start_time).toBe(now + 1000);
  });

  it('sorts descending by default (no second argument)', () => {
    const sales = [
      createMockFlashSale({ start_time: now + 1000 }),
      createMockFlashSale({ start_time: now + 2000 }),
    ];
    const result = sortFlashSalesByStartTime(sales);
    expect(result[0].start_time).toBeGreaterThan(result[1].start_time);
  });

  it('does not mutate the original array', () => {
    const sales = [
      createMockFlashSale({ start_time: now + 2000 }),
      createMockFlashSale({ start_time: now + 1000 }),
    ];
    const originalFirst = sales[0].start_time;
    sortFlashSalesByStartTime(sales, true);
    expect(sales[0].start_time).toBe(originalFirst);
  });

  it('returns empty array for empty input', () => {
    expect(sortFlashSalesByStartTime([])).toEqual([]);
  });

  it('returns single-item array unchanged', () => {
    const sale = createMockFlashSale({ start_time: now + 5000 });
    const result = sortFlashSalesByStartTime([sale]);
    expect(result).toHaveLength(1);
    expect(result[0].start_time).toBe(now + 5000);
  });

  it('preserves all items after sort', () => {
    const sales = [
      createMockFlashSale({ start_time: now + 3000 }),
      createMockFlashSale({ start_time: now + 1000 }),
      createMockFlashSale({ start_time: now + 2000 }),
    ];
    const result = sortFlashSalesByStartTime(sales, true);
    expect(result).toHaveLength(3);
  });
});
