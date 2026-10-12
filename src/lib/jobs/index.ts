/**
 * Background Job Abstraction for Crewn Platform
 * Manages asynchronous task execution, distributed Redis locking, error capturing,
 * and scheduled maintenance operations.
 */

import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis/client";
import { getStorageProvider } from "@/lib/storage";

export type JobName =
  | "CLEANUP_EXPIRED_SESSIONS"
  | "RETRY_FAILED_WEBHOOKS"
  | "PURGE_EXPIRED_INVITATIONS"
  | "CLEANUP_ORPHANED_UPLOADS"
  | "CLEANUP_OLD_NOTIFICATIONS"
  | "RECOVER_STALE_WORKFLOWS"
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

/**
 * Distributed Lock abstraction using Redis (SET NX EX + timing-safe Lua release)
 * with a process-local fallback for single-instance development/testing.
 */
export class DistributedLock {
  private redis: Redis | null = null;
  private customClientProvided = false;
  private localLocks = new Map<string, { token: string; expiresAt: number }>();

  constructor(redisClient?: Redis | null) {
    if (redisClient !== undefined) {
      this.redis = redisClient;
      this.customClientProvided = true;
    }
  }

  private getClient(): Redis | null {
    if (this.customClientProvided) return this.redis;
    return getRedisClient();
  }

  async acquire(lockKey: string, ttlSeconds = 60): Promise<string | null> {
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullKey = `lock:job:${lockKey}`;

    const client = this.getClient();
    if (client) {
      try {
        const acquired = await client.set(fullKey, token, "EX", ttlSeconds, "NX");
        return acquired === "OK" ? token : null;
      } catch (err) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            `Failed to acquire Redis lock for job "${lockKey}" in production: ${(err as Error).message}`
          );
        }
      }
    }

    // Process-local fallback for non-production environments
    const now = Date.now();
    const existing = this.localLocks.get(fullKey);
    if (existing && existing.expiresAt > now) {
      return null;
    }

    this.localLocks.set(fullKey, { token, expiresAt: now + ttlSeconds * 1000 });
    return token;
  }

  async release(lockKey: string, token: string): Promise<boolean> {
    const fullKey = `lock:job:${lockKey}`;
    const client = this.getClient();

    if (client) {
      try {
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const res = await client.eval(luaScript, 1, fullKey, token);
        return res === 1;
      } catch {
        return false;
      }
    }

    const existing = this.localLocks.get(fullKey);
    if (existing && existing.token === token) {
      this.localLocks.delete(fullKey);
      return true;
    }
    return false;
  }
}

export const distributedLock = new DistributedLock();

// ---------------------------------------------------------------------------
// Built-in Background Maintenance Handlers
// ---------------------------------------------------------------------------

// 1. Session cleanup
registerJobHandler("CLEANUP_EXPIRED_SESSIONS", async () => {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // 7 days after revocation
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
  let deadLetterCount = 0;

  for (const event of failedEvents) {
    try {
      const nextAttempts = event.attempts + 1;
      if (nextAttempts >= 5) {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            attempts: nextAttempts,
            processingStatus: "DEAD_LETTER",
            processingError: "Exceeded maximum retry attempts (5). Moved to durable DLQ.",
          },
        });
        deadLetterCount++;
      } else {
        await prisma.webhookEvent.update({
          where: { id: event.id },
          data: {
            attempts: nextAttempts,
            processingStatus: "PROCESSING",
          },
        });
        reprocessedCount++;
      }
    } catch (err) {
      logger.error({
        category: "WEBHOOK",
        message: `Failed retrying webhook event ${event.id}`,
        details: err,
      });
    }
  }

  return { success: true, result: { retriedEvents: reprocessedCount, deadLetterEvents: deadLetterCount } };
});

// 4. Orphaned upload cleanup (files older than 24h unattached to any entity)
registerJobHandler("CLEANUP_ORPHANED_UPLOADS", async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orphanedFiles = await prisma.file.findMany({
    where: {
      createdAt: { lt: cutoff },
      projectId: null,
      taskId: null,
      resourceType: null,
      resourceId: null,
      portfolioCovers: { none: {} },
      deliverableVersions: { none: {} },
      taskAttachments: { none: {} },
      messageAttachments: { none: {} },
      disputeMessages: { none: {} },
    },
    take: 50,
  });

  let deletedCount = 0;
  const storage = getStorageProvider();

  for (const file of orphanedFiles) {
    try {
      if (storage) {
        await storage.deleteFile(file.storageKey);
      }
      await prisma.file.delete({ where: { id: file.id } });
      deletedCount++;
    } catch (err) {
      logger.warn({
        category: "STORAGE",
        message: `Failed cleaning up orphaned file ${file.id}`,
        details: (err as Error).message,
      });
    }
  }

  return { success: true, result: { deletedOrphanedFiles: deletedCount } };
});

// 5. Old notification cleanup (read notifications older than 90 days)
registerJobHandler("CLEANUP_OLD_NOTIFICATIONS", async () => {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: { lt: cutoff },
    },
  });

  return { success: true, result: { deletedOldNotifications: result.count } };
});

// 6. Stale workflow recovery (mark abandoned pending payments older than 2 hours as FAILED)
registerJobHandler("RECOVER_STALE_WORKFLOWS", async () => {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const result = await prisma.paymentTransaction.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "FAILED",
    },
  });

  return { success: true, result: { recoveredTransactions: result.count } };
});

/**
 * Dispatch and execute a background job with distributed lock protection.
 */
export async function executeJob(
  name: JobName,
  payload?: Record<string, unknown>,
  options?: { lock?: DistributedLock; lockTtlSeconds?: number }
): Promise<{ success: boolean; result?: unknown; error?: string; skipped?: boolean }> {
  const handler = jobRegistry.get(name);
  if (!handler) {
    logger.warn({
      category: "BACKGROUND_JOB",
      message: `No handler registered for background job: ${name}`,
    });
    return { success: false, error: `Handler not registered for ${name}` };
  }

  const locker = options?.lock || distributedLock;
  const lockToken = await locker.acquire(name, options?.lockTtlSeconds || 60);

  if (!lockToken) {
    logger.warn({
      category: "BACKGROUND_JOB",
      message: `Job ${name} skipped: singleton lock held by another instance.`,
    });
    return {
      success: true,
      skipped: true,
      result: { skipped: true, reason: "Lock held by another instance" },
    };
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
  } finally {
    await locker.release(name, lockToken);
  }
}
