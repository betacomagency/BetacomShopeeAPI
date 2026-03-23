/**
 * Tests for Shopee Ads API Client
 */

import { vi } from 'vitest';

// Must be hoisted so vi.mock factory can reference it
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

import {
  getAdsCampaigns,
  getAdsCampaignDetail,
  updateAdsCampaignStatus,
  getAdsCampaignPerformance,
} from '../ads-client';

describe('ads-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('callAdsProxy (via getAdsCampaigns)', () => {
    it('returns responseData on success', async () => {
      const campaigns = [{ campaign_id: 1, name: 'Test Campaign' }];
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { campaigns } } },
        error: null,
      });

      const result = await getAdsCampaigns(100001);

      expect(result).toEqual({ campaigns });
    });

    it('throws when invoke returns an error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge function failed' },
      });

      await expect(getAdsCampaigns(100001)).rejects.toThrow('Edge function failed');
    });

    it('throws with default message when invoke error has no message', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {},
      });

      await expect(getAdsCampaigns(100001)).rejects.toThrow('Proxy call failed');
    });

    it('throws when responseData has error field', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { error: 'shopee_error', message: 'Invalid shop' } } },
        error: null,
      });

      await expect(getAdsCampaigns(100001)).rejects.toThrow('Invalid shop');
    });

    it('throws with generic error when responseData.error has no message', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { error: 'some_code' } } },
        error: null,
      });

      await expect(getAdsCampaigns(100001)).rejects.toThrow('Shopee error: some_code');
    });

    it('throws when responseData is null', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: null } },
        error: null,
      });

      await expect(getAdsCampaigns(100001)).rejects.toThrow(
        'No response data from /api/v2/ads/get_all_campaign_brief_list'
      );
    });
  });

  describe('getAdsCampaigns', () => {
    it('calls proxy with correct api_path and shop_id', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { list: [] } } },
        error: null,
      });

      await getAdsCampaigns(999);

      expect(mockInvoke).toHaveBeenCalledWith('apishopee-proxy', {
        body: {
          api_path: '/api/v2/ads/get_all_campaign_brief_list',
          shop_id: 999,
          method: 'GET',
          params: {},
          body: undefined,
        },
      });
    });
  });

  describe('getAdsCampaignDetail', () => {
    it('calls proxy with campaign_id in params', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { campaign_id: 42 } } },
        error: null,
      });

      await getAdsCampaignDetail(100001, 42);

      expect(mockInvoke).toHaveBeenCalledWith('apishopee-proxy', {
        body: {
          api_path: '/api/v2/ads/get_campaign_detail',
          shop_id: 100001,
          method: 'GET',
          params: { campaign_id: 42 },
          body: undefined,
        },
      });
    });
  });

  describe('updateAdsCampaignStatus', () => {
    it('calls proxy with POST method and body', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { success: true } } },
        error: null,
      });

      await updateAdsCampaignStatus(100001, 42, 'paused');

      expect(mockInvoke).toHaveBeenCalledWith('apishopee-proxy', {
        body: {
          api_path: '/api/v2/ads/update_campaign_status',
          shop_id: 100001,
          method: 'POST',
          params: {},
          body: { campaign_id: 42, status: 'paused' },
        },
      });
    });
  });

  describe('getAdsCampaignPerformance', () => {
    it('calls proxy with date range params', async () => {
      const start = 1700000000;
      const end = 1700086400;
      mockInvoke.mockResolvedValueOnce({
        data: { response: { data: { performance: [] } } },
        error: null,
      });

      await getAdsCampaignPerformance(100001, start, end);

      expect(mockInvoke).toHaveBeenCalledWith('apishopee-proxy', {
        body: {
          api_path: '/api/v2/ads/get_campaign_daily_performance',
          shop_id: 100001,
          method: 'GET',
          params: { start_date: start, end_date: end },
          body: undefined,
        },
      });
    });
  });
});
