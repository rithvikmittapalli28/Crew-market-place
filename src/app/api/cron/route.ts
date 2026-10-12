import { NextRequest, NextResponse } from "next/server";
import { executeJob, JobName } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import crypto from "crypto";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // CRON_SECRET is strictly mandatory across all environments. Fail closed if missing.
  if (!cronSecret || cronSecret.trim() === "") {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const secretHeader = req.headers.get("x-cron-secret");

  let providedSecret = "";
  if (secretHeader) {
    providedSecret = secretHeader.trim();
  } else if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) {
      providedSecret = token.trim();
    }
  }

  if (!providedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret, "utf-8");
  const expectedBuffer = Buffer.from(cronSecret, "utf-8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) {
    logger.warn({
      message: "Unauthorized cron access attempt",
      category: "SECURITY",
      details: {
        path: req.nextUrl.pathname,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        // Never log secrets or tokens
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobParam = req.nextUrl.searchParams.get("job") as JobName | null;

  const validJobs: JobName[] = [
    "CLEANUP_EXPIRED_SESSIONS",
    "PURGE_EXPIRED_INVITATIONS",
    "RETRY_FAILED_WEBHOOKS",
    "CLEANUP_ORPHANED_UPLOADS",
    "CLEANUP_OLD_NOTIFICATIONS",
    "RECOVER_STALE_WORKFLOWS",
  ];

  if (jobParam) {
    if (!validJobs.includes(jobParam)) {
      return NextResponse.json(
        { error: `Invalid job type: ${jobParam}. Must be one of: ${validJobs.join(", ")}` },
        { status: 400 }
      );
    }

    const outcome = await executeJob(jobParam);
    return NextResponse.json({
      success: outcome.success,
      job: jobParam,
      outcome,
      timestamp: new Date().toISOString(),
    });
  }

  // Run routine maintenance cycle
  const outcomes: Record<string, unknown> = {};
  for (const job of validJobs) {
    outcomes[job] = await executeJob(job);
  }

  return NextResponse.json({
    success: true,
    scheduledRun: true,
    outcomes,
    timestamp: new Date().toISOString(),
  });
}
