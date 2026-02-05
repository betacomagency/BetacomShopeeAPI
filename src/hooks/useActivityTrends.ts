/**
 * useActivityTrends - Hook để fetch và aggregate dữ liệu hoạt động theo ngày
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DailyActivityStats } from '@/components/settings/ActivityTrendChart';

interface UseActivityTrendsOptions {
  days: number;
  shopId?: number | null;
  userId?: string | null;
}

interface UseActivityTrendsResult {
  data: DailyActivityStats[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useActivityTrends({
  days,
  shopId,
  userId,
}: UseActivityTrendsOptions): UseActivityTrendsResult {
  const [data, setData] = useState<DailyActivityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Build query
      let query = supabase
        .from('system_activity_logs')
        .select('created_at, action_category')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (shopId) {
        query = query.eq('shop_id', shopId);
      }
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: logs, error: queryError } = await query;

      if (queryError) throw queryError;

      // Aggregate by day and category
      const dailyMap = new Map<string, DailyActivityStats>();

      // Initialize all days in range
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dailyMap.set(dateKey, {
          date: dateKey,
          logins: 0,
          ads: 0,
          reviews: 0,
          flash_sale: 0,
          orders: 0,
          products: 0,
          system: 0,
          total: 0,
        });
      }

      // Count activities
      (logs || []).forEach((log) => {
        const dateKey = log.created_at.split('T')[0];
        const stats = dailyMap.get(dateKey);

        if (stats) {
          const category = log.action_category as keyof Omit<DailyActivityStats, 'date' | 'total' | 'logins'>;

          if (log.action_category === 'auth') {
            stats.logins += 1;
          } else if (category in stats) {
            (stats[category] as number) += 1;
          }

          stats.total += 1;
        }
      });

      // Convert to array and sort by date
      const result = Array.from(dailyMap.values()).sort(
        (a, b) => a.date.localeCompare(b.date)
      );

      setData(result);
    } catch (err) {
      console.error('Error fetching activity trends:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch activity trends'));
    } finally {
      setLoading(false);
    }
  }, [days, shopId, userId]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { data, loading, error, refetch: fetchTrends };
}
