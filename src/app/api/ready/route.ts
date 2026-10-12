import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { getRedisClient } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

export async function GET() {
  const checks: Record<string, "ok" | "failed" | "skipped"> = {
    database: "failed",
    storage: "failed",
    redis: "skipped",
  };

  let isReady = true;

  // 1. Database readiness check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (err) {
    isReady = false;
    checks.database = "failed";
    logger.error({
      category: "API",
      message: "Database readiness check failed",
      details: (err as Error).message,
    });
  }

  // 2. Storage readiness check
  try {
    const storage = getStorageProvider();
    if (storage) {
      checks.storage = "ok";
    }
  } catch (err) {
    isReady = false;
    checks.storage = "failed";
    logger.error({
      category: "STORAGE",
      message: "Storage readiness check failed",
      details: (err as Error).message,
    });
  }

  // 3. Redis / distributed cache readiness check
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      checks.redis = "ok";
    } else if (process.env.NODE_ENV === "production") {
      isReady = false;
      checks.redis = "failed";
    } else {
      checks.redis = "skipped";
    }
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      isReady = false;
      checks.redis = "failed";
    } else {
      checks.redis = "skipped";
    }
    logger.error({
      category: "API",
      message: "Redis readiness check failed",
      details: (err as Error).message,
    });
  }

  const statusCode = isReady ? 200 : 503;

  // Never expose credentials, hostnames, secrets, or internal connection strings
  return NextResponse.json(
    {
      status: isReady ? "ready" : "unready",
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
