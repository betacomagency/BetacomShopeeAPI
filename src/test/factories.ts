/**
 * Test data factories
 * Create typed mock objects with sensible defaults
 */

import type { FlashSale } from '@/lib/shopee/flash-sale/types';
import type { AccessToken } from '@/lib/shopee/types';

let idCounter = 0;
const nextId = () => `test-uuid-${++idCounter}`;

export function createMockFlashSale(overrides?: Partial<FlashSale>): FlashSale {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: nextId(),
    shop_id: 100001,
    user_id: 'user-123',
    flash_sale_id: 1000 + idCounter,
    timeslot_id: 2000 + idCounter,
    status: 1,
    start_time: now + 3600,
    end_time: now + 7200,
    enabled_item_count: 5,
    item_count: 10,
    type: 1,
    remindme_count: 0,
    click_count: 0,
    raw_response: null,
    synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAccessToken(overrides?: Partial<AccessToken>): AccessToken {
  return {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    expire_in: 14400,
    expired_at: Date.now() + 14400 * 1000,
    shop_id: 100001,
    request_id: 'req-123',
    ...overrides,
  };
}

export function createMockProfile(overrides?: Record<string, unknown>) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    phone: null,
    system_role: 'member',
    join_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockSession(overrides?: Record<string, unknown>) {
  return {
    access_token: 'supabase-jwt-token',
    refresh_token: 'supabase-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: 'authenticated',
    },
    ...overrides,
  };
}

/** Reset the ID counter between test suites */
export function resetFactoryIds() {
  idCounter = 0;
}
