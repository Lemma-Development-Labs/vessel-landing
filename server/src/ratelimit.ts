/**
 * In-memory fixed-window rate limiter: 5 requests per 10 minutes per IP.
 *
 * Deliberately process-local — it resets on deploy and does not coordinate
 * across replicas. That is the right trade for a signup form (the unique
 * constraint on crew.email is the real duplicate defence); swap in Redis if
 * the service is ever scaled past one instance.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;
const MAX_KEYS = 50_000; // bound memory against a spray of spoofed IPs

interface Bucket {
  hits: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateVerdict {
  limited: boolean;
  retryAfterSec: number;
}

export function hit(key: string, now = Date.now()): RateVerdict {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { hits: 1, resetAt: now + WINDOW_MS });
    return { limited: false, retryAfterSec: 0 };
  }

  existing.hits += 1;
  if (existing.hits > MAX_HITS) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { limited: false, retryAfterSec: 0 };
}

/** Drop expired buckets; if everything is live, clear to stay bounded. */
function sweep(now: number): void {
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

/** Test seam. */
export function reset(): void {
  buckets.clear();
}

export const limits = { WINDOW_MS, MAX_HITS } as const;
