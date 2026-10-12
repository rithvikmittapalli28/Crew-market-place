import Redis from "ioredis";
import { getRedisClient } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

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
 * NOT suitable for multi-instance production environments.
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

      if (typeof interval === "object" && "unref" in interval) {
        (interval as unknown as { unref(): void }).unref();
      }
    }
  }

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    const record = this.cache.get(key) || { timestamps: [] };
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
 * Distributed Redis rate limiter for production multi-instance deployments.
 * Supports standard Redis protocol (via ioredis) or Upstash Redis REST.
 * Strictly prevents silent in-memory fallback in production.
 */
export class RedisRateLimiter implements RateLimiter {
  private redisUrl?: string;
  private redisToken?: string;
  private client?: Redis | null;

  constructor(
    optionsOrUrl?: { redisUrl?: string; redisToken?: string; client?: Redis } | string,
    redisToken?: string
  ) {
    if (typeof optionsOrUrl === "string") {
      this.redisUrl = optionsOrUrl;
      this.redisToken = redisToken;
      this.client = null;
    } else {
      this.redisUrl = optionsOrUrl?.redisUrl || process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
      this.redisToken = optionsOrUrl?.redisToken || process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
      this.client = optionsOrUrl?.client ?? null;
    }
  }

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const isProd = process.env.NODE_ENV === "production";
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // 1. If standard Redis client is available or configured
    try {
      const redis = this.client || getRedisClient();
      if (redis) {
        const pipeline = redis.pipeline();
        pipeline.zremrangebyscore(redisKey, 0, windowStart);
        pipeline.zcard(redisKey);
        pipeline.zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
        pipeline.pexpire(redisKey, windowMs);

        const results = await pipeline.exec();
        if (results && results[1]) {
          const count = (results[1][1] as number) || 0;
          if (count >= limit) {
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
            remaining: Math.max(0, limit - count - 1),
            resetAt: now + windowMs,
          };
        }
      }
    } catch (err) {
      if (isProd) {
        logger.error({
          category: "SECURITY",
          message: "Production Redis rate limiter failed",
          details: (err as Error).message,
        });
        throw new Error(
          `Production rate limiting failure: Redis is unavailable and silent in-memory fallback is forbidden in production.`
        );
      }
    }

    // 2. Upstash REST fallback if configured
    if (this.redisToken && this.redisUrl && this.redisUrl.startsWith("http")) {
      try {
        const url = `${this.redisUrl}/pipeline`;
        const commands = [
          ["ZREMRANGEBYSCORE", redisKey, 0, windowStart],
          ["ZCARD", redisKey],
          ["ZADD", redisKey, now, `${now}-${Math.random().toString(36).slice(2, 8)}`],
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
      } catch (err) {
        if (isProd) {
          throw new Error(
            `Production Upstash rate limiter failure: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // In production, NEVER silently fall back to in-memory rate limiting!
    if (isProd) {
      throw new Error(
        "REDIS_URL must be configured for rate limiting in production. Silent in-memory fallback is disabled."
      );
    }

    // Explicitly permitted development/test fallback only
    const devLimiter = new InMemoryRateLimiter();
    return devLimiter.limit(key, limit, windowMs);
  }
}

let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (rateLimiterInstance) return rateLimiterInstance;

  const isProd = process.env.NODE_ENV === "production";
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

  if (isProd) {
    if (!redisUrl) {
      throw new Error(
        "Production rate limiting requires a distributed Redis configuration (REDIS_URL or UPSTASH_REDIS_REST_URL)."
      );
    }
    rateLimiterInstance = new RedisRateLimiter();
    return rateLimiterInstance;
  }

  if (redisUrl) {
    rateLimiterInstance = new RedisRateLimiter();
  } else {
    // Development fallback
    rateLimiterInstance = new InMemoryRateLimiter();
  }

  return rateLimiterInstance;
}

export function resetRateLimiter(): void {
  rateLimiterInstance = null;
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
