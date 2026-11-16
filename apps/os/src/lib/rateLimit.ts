/**
 * Sliding-window rate limiter for authentication & sensitive API endpoints.
 * Protects against brute-force PIN/OTP guessing and credential stuffing.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((ts) => ts > cutoff);

  if (bucket.hits.length >= maxRequests) {
    const oldest = bucket.hits[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Periodic cleanup to keep memory bounded
  if (buckets.size > 5000) {
    for (const [k, b] of buckets.entries()) {
      if (b.hits.every((ts) => ts <= cutoff)) buckets.delete(k);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.hits.length),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
