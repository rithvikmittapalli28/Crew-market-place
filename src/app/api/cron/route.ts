import { NextRequest, NextResponse } from "next/server";
import { executeJob, JobName } from "@/lib/jobs";
import { logger } from "@/lib/logger";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In development without a secret, allow local testing; in production/staging require CRON_SECRET
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const secretHeader = req.headers.get("x-cron-secret");

  if (secretHeader && secretHeader === cronSecret) {
    return true;
  }

  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token === cronSecret) {
      return true;
    }
  }

  return false;
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
      },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobParam = req.nextUrl.searchParams.get("job") as JobName | null;

  const validJobs: JobName[] = [
    "CLEANUP_EXPIRED_SESSIONS",
    "PURGE_EXPIRED_INVITATIONS",
    "RETRY_FAILED_WEBHOOKS",
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
