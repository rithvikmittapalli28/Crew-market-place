/**
 * Background Job Abstraction for Crewn Platform
 * Manages asynchronous task execution, error capturing, and scheduled maintenance operations.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type JobName =
  | "CLEANUP_EXPIRED_SESSIONS"
  | "RETRY_FAILED_WEBHOOKS"
  | "PURGE_EXPIRED_INVITATIONS"
  | "SEND_TRANSACTIONAL_EMAIL";

export interface JobContext {
  id: string;
  name: JobName;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

export type JobHandler = (context: JobContext) => Promise<{ success: boolean; result?: unknown }>;

const jobRegistry = new Map<JobName, JobHandler>();

/**
 * Register a background job handler
 */
export function registerJobHandler(name: JobName, handler: JobHandler) {
  jobRegistry.set(name, handler);
}

// ---------------------------------------------------------------------------
// Built-in Background Maintenance Handlers
// ---------------------------------------------------------------------------

// 1. Session cleanup
registerJobHandler("CLEANUP_EXPIRED_SESSIONS", async () => {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // 30 days after revocation
      ],
    },
  });

  return { success: true, result: { deletedSessions: result.count } };
});

// 2. Expired invitation cleanup
registerJobHandler("PURGE_EXPIRED_INVITATIONS", async () => {
  const [projInv, teamInv] = await Promise.all([
    prisma.projectInvitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    }),
    prisma.teamInvitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    }),
  ]);

  return {
    success: true,
    result: { expiredProjects: projInv.count, expiredTeams: teamInv.count },
  };
});

// 3. Webhook retry handler
registerJobHandler("RETRY_FAILED_WEBHOOKS", async () => {
  // Finds unhandled or failed webhook events with attempts < 5
  const failedEvents = await prisma.webhookEvent.findMany({
    where: {
      isProcessed: false,
      processingStatus: "FAILED",
      attempts: { lt: 5 },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  let reprocessedCount = 0;

  for (const event of failedEvents) {
    try {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          processingStatus: "PROCESSING",
        },
      });

      // The caller / route handles event reprocessing
      reprocessedCount++;
    } catch (err) {
      logger.error({
        category: "WEBHOOK",
        message: `Failed retrying webhook event ${event.id}`,
        details: err,
      });
    }
  }

  return { success: true, result: { retriedEvents: reprocessedCount } };
});

/**
 * Dispatch and execute a background job
 */
export async function executeJob(
  name: JobName,
  payload?: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const handler = jobRegistry.get(name);
  if (!handler) {
    logger.warn({
      category: "BACKGROUND_JOB",
      message: `No handler registered for background job: ${name}`,
    });
    return { success: false, error: `Handler not registered for ${name}` };
  }

  const context: JobContext = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    payload,
    createdAt: new Date(),
  };

  logger.info({
    category: "BACKGROUND_JOB",
    message: `Executing background job: ${name}`,
    details: { jobId: context.id },
  });

  try {
    const outcome = await handler(context);
    logger.info({
      category: "BACKGROUND_JOB",
      message: `Completed background job: ${name}`,
      details: { jobId: context.id, outcome },
    });
    return outcome;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({
      category: "BACKGROUND_JOB",
      message: `Failed background job: ${name}`,
      details: { jobId: context.id, error: errorMsg },
    });
    return { success: false, error: errorMsg };
  }
}
