import { prisma } from "@/lib/prisma";

export type AuthAuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "FAILED_LOGIN"
  | "REGISTRATION"
  | "EMAIL_VERIFIED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "PASSWORD_CHANGED"
  | "SESSION_REVOKED";

export interface LogAuthEventParams {
  action: AuthAuditAction;
  userId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Records an authentication security event in ActivityLog.
 * Guaranteed never to log passwords, raw tokens, or session identifiers.
 */
export async function logAuthEvent(params: {
  action: AuthAuditAction;
  userId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const safeMetadata = { ...params.metadata };

    // Strip any sensitive fields if accidentally passed
    delete safeMetadata.password;
    delete safeMetadata.newPassword;
    delete safeMetadata.token;
    delete safeMetadata.tokenHash;
    delete safeMetadata.sessionToken;

    const targetUserId = params.userId || params.actorId || "system";

    await prisma.activityLog.create({
      data: {
        entityType: "AUTH",
        entityId: targetUserId,
        action: params.action,
        actorId: params.actorId || (params.userId && params.userId !== "system" ? params.userId : null),
        ipAddress: params.ipAddress || null,
        metadataJson: Object.keys(safeMetadata).length > 0 ? JSON.stringify(safeMetadata) : null,
      },
    });
  } catch (error) {
    // Non-blocking: Audit log failure must not crash the primary auth flow
    console.error("Failed to write auth audit event:", error);
  }
}
