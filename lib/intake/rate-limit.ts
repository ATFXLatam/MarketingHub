// In-memory rate limit per key (sliding window of timestamps). On Vercel serverless the Map lives per
// isolate, so the limit is not airtight across cold instances/regions: it brakes bursts and double
// submits, it is not a hard control (that would need Redis/KV, tracked debt). Dead buckets are purged
// on write so the Map does not grow with every unique key.

export function createRateLimiter(max: number, windowMs: number): (key: string) => boolean {
  const buckets = new Map<string, number[]>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    for (const [k, hits] of buckets) {
      if (hits.length === 0 || hits[hits.length - 1] <= cutoff) buckets.delete(k);
    }
    const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= max) {
      buckets.set(key, hits);
      return true;
    }
    buckets.set(key, [...hits, now]);
    return false;
  };
}
