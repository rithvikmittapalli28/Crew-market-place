import Redis, { RedisOptions } from "ioredis";
import { logger } from "@/lib/logger";

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

export function getRedisConfig(): { url: string; options: RedisOptions } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  return {
    url,
    options: {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    },
  };
}

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const config = getRedisConfig();
  const isBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";
  if (!config) {
    if (process.env.NODE_ENV === "production" && !isBuild) {
      throw new Error(
        "REDIS_URL environment variable is required in production for distributed locking, rate limiting, and multi-instance SSE."
      );
    }
    return null;
  }

  try {
    redisClient = new Redis(config.url, config.options);
    redisClient.on("error", (err) => {
      logger.error({
        category: "API",
        message: "Redis client error",
        details: err.message,
      });
    });
    return redisClient;
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Failed to initialize Redis client in production: ${(err as Error).message}`);
    }
    return null;
  }
}

export function getRedisSubscriber(): Redis | null {
  if (redisSubscriber) return redisSubscriber;

  const config = getRedisConfig();
  const isBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";
  if (!config) {
    if (process.env.NODE_ENV === "production" && !isBuild) {
      throw new Error(
        "REDIS_URL environment variable is required in production for realtime SSE subscriber."
      );
    }
    return null;
  }

  try {
    redisSubscriber = new Redis(config.url, config.options);
    redisSubscriber.on("error", (err) => {
      logger.error({
        category: "API",
        message: "Redis subscriber error",
        details: err.message,
      });
    });
    return redisSubscriber;
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Failed to initialize Redis subscriber in production: ${(err as Error).message}`);
    }
    return null;
  }
}

/**
 * Reset Redis singletons (useful in testing)
 */
export async function resetRedisClients(): Promise<void> {
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch {
      // ignore
    }
    redisClient = null;
  }
  if (redisSubscriber) {
    try {
      redisSubscriber.disconnect();
    } catch {
      // ignore
    }
    redisSubscriber = null;
  }
}
