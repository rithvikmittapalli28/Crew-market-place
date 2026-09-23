export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * Sliding window in-memory rate limiter for development and local testing.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private cache = new Map<string, { timestamps: number[] }>();

  constructor() {
    // Stale entries cleanup every 10 minutes
    if (typeof setInterval !== "undefined") {
      const interval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.cache.entries()) {
          record.timestamps = record.timestamps.filter((ts) => now - ts < 3600 * 1000);
          if (record.timestamps.length === 0) {
            this.cache.delete(key);
          }
        }
      }, 10 * 60 * 1000);

      // Unref interval in Node environments so it doesn't block shutdown
      if (typeof interval === "object" && "unref" in interval) {
        (interval as unknown as { unref(): void }).unref();
      }
    }
  }

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    const record = this.cache.get(key) || { timestamps: [] };
    // Remove timestamps older than the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= limit) {
      const oldestTimestamp = record.timestamps[0];
      const resetAt = oldestTimestamp + windowMs;
      return {
        success: false,
        limit,
        remaining: 0,
        resetAt,
      };
    }

    record.timestamps.push(now);
    this.cache.set(key, record);

    return {
      success: true,
      limit,
      remaining: limit - record.timestamps.length,
      resetAt: now + windowMs,
    };
  }
}

/**
 * Shared Redis-compatible rate limiter for production multi-instance deployments.
 * Supports Upstash Redis REST or standard Redis-compatible backends.
 */
export class RedisRateLimiter implements RateLimiter {
  private redisUrl: string;
  private redisToken?: string;
  private fallback: InMemoryRateLimiter;

  constructor(redisUrl: string, redisToken?: string) {
    this.redisUrl = redisUrl;
    this.redisToken = redisToken;
    this.fallback = new InMemoryRateLimiter();
  }

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    try {
      // If Upstash REST API configured
      if (this.redisToken && this.redisUrl.startsWith("http")) {
        const url = `${this.redisUrl}/pipeline`;
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `ratelimit:${key}`;

        const commands = [
          ["ZREMRANGEBYSCORE", redisKey, 0, windowStart],
          ["ZCARD", redisKey],
          ["ZADD", redisKey, now, `${now}-${Math.random()}`],
          ["PEXPIRE", redisKey, windowMs],
        ];

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.redisToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(commands),
        });

        if (res.ok) {
          const results = await res.json();
          const currentCount = (results[1]?.result ?? 0) as number;
          if (currentCount >= limit) {
            return {
              success: false,
              limit,
              remaining: 0,
              resetAt: now + windowMs,
            };
          }
          return {
            success: true,
            limit,
            remaining: Math.max(0, limit - currentCount - 1),
            resetAt: now + windowMs,
          };
        }
      }

      // Graceful fallback to memory limiter if Redis request fails
      return this.fallback.limit(key, limit, windowMs);
    } catch {
      return this.fallback.limit(key, limit, windowMs);
    }
  }
}

// Singleton provider instance behind abstraction
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (rateLimiterInstance) return rateLimiterInstance;

  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisUrl.startsWith("http")) {
    rateLimiterInstance = new RedisRateLimiter(redisUrl, redisToken);
  } else {
    rateLimiterInstance = new InMemoryRateLimiter();
  }

  return rateLimiterInstance;
}

/**
 * Convenient wrapper function for endpoint handlers.
 */
export async function rateLimit(
  key: string,
  limit = 10,
  windowMs = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const limiter = getRateLimiter();
  return limiter.limit(key, limit, windowMs);
}

/**
 * Helper to extract client IP address from Next.js request headers.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
