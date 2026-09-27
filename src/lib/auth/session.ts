import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { User, Session } from "@prisma/client";
import { logAuthEvent } from "./audit";

export const SESSION_COOKIE_NAME = "crewn_session";

// 14 days absolute session lifetime
export const ABSOLUTE_SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

// 24 hours idle timeout
export const IDLE_SESSION_TIMEOUT_SECONDS = 24 * 60 * 60;

// Safe throttled write interval: 5 minutes
export const ACTIVITY_UPDATE_THROTTLE_SECONDS = 5 * 60;

/**
 * Computes a secure SHA-256 hash of a raw token.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a cryptographically secure random token (default 32 bytes / 256 bits).
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

export type SessionWithUser = Session & { user: User };

/**
 * Creates an authoritative session in PostgreSQL with a SHA-256 token hash
 * and sets an opaque 256-bit cryptographically secure token in an httpOnly cookie.
 */
export async function createSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  // 1. Generate 256-bit opaque random token
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + ABSOLUTE_SESSION_MAX_AGE_SECONDS * 1000);
  const now = new Date();

  // 2. Persist session record in PostgreSQL
  const sessionRecord = await prisma.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      expiresAt,
      lastActivityAt: now,
      lastReauthenticatedAt: now,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  });

  // 3. Set secure HTTP-only cookie with the raw opaque token if in request scope
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ABSOLUTE_SESSION_MAX_AGE_SECONDS,
      expires: expiresAt,
    });
  } catch {
    // Non-request context (e.g. testing / background jobs)
  }

  return { token: rawToken, expiresAt, sessionId: sessionRecord.id };
}

/**
 * Validates the session from the incoming cookie against PostgreSQL.
 * PostgreSQL Session record is the authoritative source for:
 * - user
 * - expiration
 * - idle timeout
 * - revocation
 * - lastActivityAt
 */
export async function getSessionRecord(): Promise<SessionWithUser | null> {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) return null;

    const tokenHash = hashToken(rawToken);

    // Query authoritative database record
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt) {
      return null;
    }

    const now = new Date();

    // 1. Check absolute expiration
    if (session.expiresAt <= now) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // 2. Check idle timeout (24 hours)
    const idleExpiration = new Date(
      session.lastActivityAt.getTime() + IDLE_SESSION_TIMEOUT_SECONDS * 1000
    );
    if (idleExpiration <= now) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // 3. Update lastActivityAt safely without creating excessive database writes
    // Only update if more than 5 minutes have elapsed since the last update
    const secondsSinceLastActivity =
      (now.getTime() - session.lastActivityAt.getTime()) / 1000;

    if (secondsSinceLastActivity > ACTIVITY_UPDATE_THROTTLE_SECONDS) {
      // Fire-and-forget throttled update
      prisma.session
        .update({
          where: { id: session.id },
          data: { lastActivityAt: now },
        })
        .catch((err) => console.error("Error updating session lastActivityAt:", err));
    }

    return session;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw error;
    }
    console.error("Error in getSessionRecord:", error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSessionRecord();
  return session ? session.user : null;
}

/**
 * Compatibility helper returning basic session payload from authoritative DB session.
 */
export async function getSession(): Promise<{
  userId: string;
  email: string;
  role: string;
  onboarded: boolean;
  sessionId: string;
} | null> {
  const session = await getSessionRecord();
  if (!session || !session.user || !session.user.isActive) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    onboarded: session.user.onboarded,
    sessionId: session.id,
  };
}

/**
 * Revokes the current session and clears the session cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const existing = await prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });

    if (existing) {
      await prisma.session.delete({
        where: { id: existing.id },
      }).catch(() => {});

      await logAuthEvent({
        action: "SESSION_REVOKED",
        userId: existing.userId,
        actorId: existing.userId,
      });
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Revokes ALL sessions for a user (e.g. after password reset).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  }).catch(() => {});

  await logAuthEvent({
    action: "SESSION_REVOKED",
    userId,
    actorId: userId,
    metadata: { reason: "REVOKE_ALL" },
  });
}

/**
 * Marks the session as freshly re-authenticated (updates lastReauthenticatedAt).
 */
export async function markSessionReauthenticated(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastReauthenticatedAt: new Date() },
  }).catch(() => {});
}
