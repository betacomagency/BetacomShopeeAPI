/**
 * Unit Tests: validateFlashSaleItem + UI mapping functions
 * Covers all 8 validation branches and 4 UI mapping functions
 */

import {
  validateFlashSaleItem,
  getStatusColor,
  getStatusLabel,
  getTypeIcon,
  getTypeLabel,
} from '../utils';
import type { FlashSaleStatus, FlashSaleType } from '../types';

// ==================== validateFlashSaleItem ====================

describe('validateFlashSaleItem', () => {
  it('rejects when item_id is missing', () => {
    const result = validateFlashSaleItem({ purchase_limit: 1, item_input_promo_price: 100, item_stock: 5 });
    expect(result).toEqual({ valid: false, error: 'item_id is required' });
  });

  it('rejects when item_id is 0', () => {
    const result = validateFlashSaleItem({ item_id: 0, purchase_limit: 1, item_input_promo_price: 100, item_stock: 5 });
    expect(result).toEqual({ valid: false, error: 'item_id is required' });
  });

  it('rejects when purchase_limit is undefined', () => {
    const result = validateFlashSaleItem({ item_id: 1, item_input_promo_price: 100, item_stock: 5 });
    expect(result).toEqual({ valid: false, error: 'purchase_limit must be >= 0' });
  });

  it('rejects when purchase_limit is negative', () => {
    const result = validateFlashSaleItem({ item_id: 1, purchase_limit: -1, item_input_promo_price: 100, item_stock: 5 });
    expect(result).toEqual({ valid: false, error: 'purchase_limit must be >= 0' });
  });

  it('rejects when neither models nor item_input_promo_price provided', () => {
    const result = validateFlashSaleItem({ item_id: 1, purchase_limit: 1 });
    expect(result).toEqual({ valid: false, error: 'Either models or item_input_promo_price is required' });
  });

  // Non-variant item validation
  describe('non-variant item', () => {
    it('accepts valid non-variant item', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 2, item_input_promo_price: 50000, item_stock: 10,
      });
      expect(result).toEqual({ valid: true });
    });

    it('rejects when item_input_promo_price is 0', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1, item_input_promo_price: 0, item_stock: 5,
      });
      expect(result).toEqual({ valid: false, error: 'item_input_promo_price must be > 0' });
    });

    it('rejects when item_input_promo_price is negative', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1, item_input_promo_price: -100, item_stock: 5,
      });
      expect(result).toEqual({ valid: false, error: 'item_input_promo_price must be > 0' });
    });

    it('rejects when item_stock is undefined', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1, item_input_promo_price: 100,
      });
      expect(result).toEqual({ valid: false, error: 'item_stock must be >= 0' });
    });

    it('rejects when item_stock is negative', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1, item_input_promo_price: 100, item_stock: -1,
      });
      expect(result).toEqual({ valid: false, error: 'item_stock must be >= 0' });
    });

    it('accepts when item_stock is 0', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 0, item_input_promo_price: 100, item_stock: 0,
      });
      expect(result).toEqual({ valid: true });
    });
  });

  // Variant item validation
  describe('variant item', () => {
    it('accepts valid variant item with models', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 2,
        models: [{ model_id: 10, input_promo_price: 5000, stock: 3 }],
      });
      expect(result).toEqual({ valid: true });
    });

    it('accepts multiple valid models', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [
          { model_id: 10, input_promo_price: 5000, stock: 3 },
          { model_id: 20, input_promo_price: 8000, stock: 0 },
        ],
      });
      expect(result).toEqual({ valid: true });
    });

    it('rejects when model_id is missing', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [{ input_promo_price: 5000, stock: 3 }],
      });
      expect(result).toEqual({ valid: false, error: 'model_id is required for variant items' });
    });

    it('rejects when model input_promo_price is 0', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [{ model_id: 10, input_promo_price: 0, stock: 3 }],
      });
      expect(result).toEqual({ valid: false, error: 'input_promo_price must be > 0' });
    });

    it('rejects when model input_promo_price is undefined', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [{ model_id: 10, stock: 3 }],
      });
      expect(result).toEqual({ valid: false, error: 'input_promo_price must be > 0' });
    });

    it('rejects when model stock is negative', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [{ model_id: 10, input_promo_price: 5000, stock: -1 }],
      });
      expect(result).toEqual({ valid: false, error: 'stock must be >= 0' });
    });

    it('rejects when model stock is undefined', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [{ model_id: 10, input_promo_price: 5000 }],
      });
      expect(result).toEqual({ valid: false, error: 'stock must be >= 0' });
    });

    it('fails on first invalid model in array', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1,
        models: [
          { model_id: 10, input_promo_price: 5000, stock: 3 },
          { model_id: 20, input_promo_price: -1, stock: 3 },
        ],
      });
      expect(result).toEqual({ valid: false, error: 'input_promo_price must be > 0' });
    });

    it('prefers models over item_input_promo_price when both provided', () => {
      const result = validateFlashSaleItem({
        item_id: 1, purchase_limit: 1, item_input_promo_price: 100, item_stock: 5,
        models: [{ model_id: 10, input_promo_price: 5000, stock: 3 }],
      });
      expect(result).toEqual({ valid: true });
    });
  });
});

// ==================== UI Mapping Functions ====================

describe('getStatusColor', () => {
  const cases: [FlashSaleStatus, string][] = [
    [0, 'gray'],
    [1, 'green'],
    [2, 'yellow'],
    [3, 'red'],
  ];

  it.each(cases)('status %i → %s', (status, expected) => {
    expect(getStatusColor(status)).toBe(expected);
  });

  it('returns gray for unknown status', () => {
    expect(getStatusColor(99 as FlashSaleStatus)).toBe('gray');
  });
});

describe('getStatusLabel', () => {
  const cases: [FlashSaleStatus, string][] = [
    [0, 'Đã xóa'],
    [1, 'Bật'],
    [2, 'Tắt'],
    [3, 'Từ chối'],
  ];

  it.each(cases)('status %i → %s', (status, expected) => {
    expect(getStatusLabel(status)).toBe(expected);
  });

  it('returns fallback for unknown status', () => {
    expect(getStatusLabel(99 as FlashSaleStatus)).toBe('Không xác định');
  });
});

describe('getTypeIcon', () => {
  const cases: [FlashSaleType, string][] = [
    [1, '⏳'],
    [2, '🔥'],
    [3, '✓'],
  ];

  it.each(cases)('type %i → %s', (type, expected) => {
    expect(getTypeIcon(type)).toBe(expected);
  });

  it('returns ? for unknown type', () => {
    expect(getTypeIcon(99 as FlashSaleType)).toBe('?');
  });
});

describe('getTypeLabel', () => {
  const cases: [FlashSaleType, string][] = [
    [1, 'Sắp tới'],
    [2, 'Đang chạy'],
    [3, 'Kết thúc'],
  ];

  it.each(cases)('type %i → %s', (type, expected) => {
    expect(getTypeLabel(type)).toBe(expected);
  });

  it('returns fallback for unknown type', () => {
    expect(getTypeLabel(99 as FlashSaleType)).toBe('Không xác định');
  });
});
