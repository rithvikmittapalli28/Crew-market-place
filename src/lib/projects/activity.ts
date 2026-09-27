import { prisma } from "@/lib/prisma";

export interface LogProjectActivityParams {
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Writes an ActivityLog entry for project-related mutations.
 * Always called as fire-and-forget (caller should .catch(console.error) the returned promise).
 */
export function logProjectActivity(params: LogProjectActivityParams): Promise<void> {
  return prisma.activityLog
    .create({
      data: {
        projectId: params.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actorId: params.actorId,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress ?? null,
      },
    })
    .then(() => undefined)
    .catch((err) => {
      console.error("[ActivityLog] Failed to write activity log:", err);
    });
}
