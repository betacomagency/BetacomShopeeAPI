/**
 * Unit Tests: Flash Sale Display Pipeline and Validation Utilities
 * Covers: getPaginationInfo, canEditFlashSale, canDeleteFlashSale,
 *         processFlashSalesForDisplay, getErrorMessage
 */

import {
  getPaginationInfo,
  canEditFlashSale,
  canDeleteFlashSale,
  processFlashSalesForDisplay,
  getErrorMessage,
} from '@/lib/shopee/flash-sale/utils';
import { SHOPEE_ERROR_CODES, ERROR_MESSAGES } from '@/lib/shopee/flash-sale/types';
import { createMockFlashSale, resetFactoryIds } from '@/test/factories';

beforeEach(() => {
  resetFactoryIds();
});

// ==================== getPaginationInfo ====================

describe('getPaginationInfo', () => {
  it('returns correct totalItems and totalPages for non-empty array', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 1, 10);
    expect(info.totalItems).toBe(25);
    expect(info.totalPages).toBe(3);
  });

  it('returns totalPages=0 for empty array', () => {
    const info = getPaginationInfo([], 1, 10);
    expect(info.totalPages).toBe(0);
    expect(info.totalItems).toBe(0);
  });

  it('returns correct currentPage', () => {
    const sales = Array.from({ length: 30 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 2, 10);
    expect(info.currentPage).toBe(2);
  });

  it('returns correct startIndex and endIndex for page 1', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 1, 10);
    expect(info.startIndex).toBe(0);
    expect(info.endIndex).toBe(10);
  });

  it('returns correct startIndex and endIndex for last partial page', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 3, 10);
    expect(info.startIndex).toBe(20);
    expect(info.endIndex).toBe(25);
  });

  it('hasNextPage=true when not on last page', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 1, 10);
    expect(info.hasNextPage).toBe(true);
  });

  it('hasNextPage=false on last page', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 3, 10);
    expect(info.hasNextPage).toBe(false);
  });

  it('hasPrevPage=false on first page', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 1, 10);
    expect(info.hasPrevPage).toBe(false);
  });

  it('hasPrevPage=true on page 2+', () => {
    const sales = Array.from({ length: 25 }, () => createMockFlashSale());
    const info = getPaginationInfo(sales, 2, 10);
    expect(info.hasPrevPage).toBe(true);
  });
});

// ==================== canEditFlashSale ====================

describe('canEditFlashSale', () => {
  it('returns true for upcoming (type=1) regardless of status', () => {
    const sale = createMockFlashSale({ type: 1, status: 2 });
    expect(canEditFlashSale(sale)).toBe(true);
  });

  it('returns true for ongoing (type=2) with enabled status (status=1)', () => {
    const sale = createMockFlashSale({ type: 2, status: 1 });
    expect(canEditFlashSale(sale)).toBe(true);
  });

  it('returns false for ongoing (type=2) with disabled status (status=2)', () => {
    const sale = createMockFlashSale({ type: 2, status: 2 });
    expect(canEditFlashSale(sale)).toBe(false);
  });

  it('returns false for ongoing (type=2) with deleted status (status=0)', () => {
    const sale = createMockFlashSale({ type: 2, status: 0 });
    expect(canEditFlashSale(sale)).toBe(false);
  });

  it('returns false for expired (type=3) with enabled status', () => {
    const sale = createMockFlashSale({ type: 3, status: 1 });
    expect(canEditFlashSale(sale)).toBe(false);
  });

  it('returns false for expired (type=3) with disabled status', () => {
    const sale = createMockFlashSale({ type: 3, status: 2 });
    expect(canEditFlashSale(sale)).toBe(false);
  });
});

// ==================== canDeleteFlashSale ====================

describe('canDeleteFlashSale', () => {
  it('returns true only for upcoming (type=1)', () => {
    const sale = createMockFlashSale({ type: 1 });
    expect(canDeleteFlashSale(sale)).toBe(true);
  });

  it('returns false for ongoing (type=2)', () => {
    const sale = createMockFlashSale({ type: 2 });
    expect(canDeleteFlashSale(sale)).toBe(false);
  });

  it('returns false for expired (type=3)', () => {
    const sale = createMockFlashSale({ type: 3 });
    expect(canDeleteFlashSale(sale)).toBe(false);
  });
});

// ==================== processFlashSalesForDisplay ====================

describe('processFlashSalesForDisplay', () => {
  it('returns all sales when filterType is "0"', () => {
    const sales = [
      createMockFlashSale({ type: 1 }),
      createMockFlashSale({ type: 2 }),
      createMockFlashSale({ type: 3 }),
    ];
    const { data, pagination } = processFlashSalesForDisplay(sales, '0', 1, 10);
    expect(pagination.totalItems).toBe(3);
    expect(data).toHaveLength(3);
  });

  it('filters by type when filterType is "1"', () => {
    const sales = [
      createMockFlashSale({ type: 1 }),
      createMockFlashSale({ type: 2 }),
      createMockFlashSale({ type: 1 }),
    ];
    const { data } = processFlashSalesForDisplay(sales, '1', 1, 10);
    expect(data.every((s) => s.type === 1)).toBe(true);
  });

  it('paginates results correctly', () => {
    const sales = Array.from({ length: 15 }, () => createMockFlashSale({ type: 1 }));
    const { data, pagination } = processFlashSalesForDisplay(sales, '1', 2, 10);
    expect(data).toHaveLength(5);
    expect(pagination.currentPage).toBe(2);
    expect(pagination.totalPages).toBe(2);
  });

  it('returns empty data for empty sales array', () => {
    const { data, pagination } = processFlashSalesForDisplay([], '0', 1, 10);
    expect(data).toHaveLength(0);
    expect(pagination.totalItems).toBe(0);
  });

  it('sorts by priority: ongoing before upcoming before expired', () => {
    const sales = [
      createMockFlashSale({ type: 3 }),
      createMockFlashSale({ type: 1 }),
      createMockFlashSale({ type: 2 }),
    ];
    const { data } = processFlashSalesForDisplay(sales, '0', 1, 10);
    expect(data[0].type).toBe(2);
    expect(data[1].type).toBe(1);
    expect(data[2].type).toBe(3);
  });
});

// ==================== getErrorMessage ====================

describe('getErrorMessage', () => {
  it('returns known message for exact error code match', () => {
    const code = SHOPEE_ERROR_CODES.ALREADY_EXIST;
    expect(getErrorMessage(code)).toBe(ERROR_MESSAGES[code]);
  });

  it('returns known message for AUTH_ERROR code', () => {
    const code = SHOPEE_ERROR_CODES.AUTH_ERROR;
    expect(getErrorMessage(code)).toBe(ERROR_MESSAGES[code]);
  });

  it('returns known message for SERVER_ERROR code', () => {
    const code = SHOPEE_ERROR_CODES.SERVER_ERROR;
    expect(getErrorMessage(code)).toBe(ERROR_MESSAGES[code]);
  });

  it('returns fallback containing the code for unknown error', () => {
    const unknownCode = 'totally_unknown_xyz_error_code';
    const result = getErrorMessage(unknownCode);
    expect(result).toContain(unknownCode);
  });

  it('returns a message for partial code match (substring)', () => {
    // INVALID_TOKEN code contains "Invalid access_token"; pass substring
    const result = getErrorMessage('Invalid access_token');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
