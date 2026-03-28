import Bottleneck from 'bottleneck';

/**
 * Per-partner-app rate limiters to prevent Shopee 429 errors.
 * Each partner app gets its own limiter: max 5 concurrent, 200ms min spacing.
 */
const limiters = new Map<string, Bottleneck>();

export function getLimiter(partnerAppId: string): Bottleneck {
  if (!limiters.has(partnerAppId)) {
    limiters.set(partnerAppId, new Bottleneck({
      maxConcurrent: 5,
      minTime: 200, // 200ms between requests = max 5/sec per partner app
    }));
  }
  return limiters.get(partnerAppId)!;
}

/** Default limiter for cases where partner app is unknown */
export const defaultLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 300,
});
