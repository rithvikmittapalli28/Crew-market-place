import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { getRateLimiter } from "@/lib/auth/rate-limit";
import { logger } from "@/lib/logger";

export async function GET() {
  const checks: Record<string, "ok" | "degraded" | "failed"> = {
    database: "failed",
    storage: "failed",
    rateLimiter: "failed",
  };

  let isReady = true;

  // 1. Database readiness
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (err) {
    isReady = false;
    checks.database = "failed";
    logger.error({
      category: "API",
      message: "Database readiness check failed",
      details: err,
    });
  }

  // 2. Storage readiness
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
      details: err,
    });
  }

  // 3. Rate limiter readiness
  try {
    const limiter = getRateLimiter();
    if (limiter) {
      checks.rateLimiter = "ok";
    }
  } catch {
    checks.rateLimiter = "degraded";
  }

  const statusCode = isReady ? 200 : 503;

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
