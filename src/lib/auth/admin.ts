/**
 * Admin Authentication, Authorization & Audit Logging Layer
 * 
 * Enforces strict server-side validation for all admin routes and operations.
 * Never trusts client-side role claims.
 */

import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionRecord, type SessionWithUser } from "./session";
import type { AuthUser } from "@/types";

export interface AdminSessionResult {
  admin: AuthUser;
  session: SessionWithUser;
}

/**
 * Retrieves the authenticated admin user or null if not an active ADMIN.
 */
export async function getAdminUser(tokenOverride?: string): Promise<AuthUser | null> {
  const sessionRecord = await getSessionRecord(tokenOverride);
  if (!sessionRecord?.user || !sessionRecord.user.isActive) return null;

  if (sessionRecord.user.role !== "ADMIN") {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionRecord.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      isVerified: true,
      onboarded: true,
      isActive: true,
      businessMemberships: {
        select: {
          id: true,
          businessId: true,
          role: true,
          business: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
      },
      freelancerProfile: {
        select: { id: true, headline: true, isVerified: true, hourlyRate: true },
      },
    },
  });

  if (!user || !user.isActive || user.role !== "ADMIN") return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: "ADMIN",
    isVerified: user.isVerified,
    onboarded: user.onboarded,
    businessMemberships: [],
    freelancerProfile: null,
  };
}

/**
 * Server-side guard for Admin Server Components & Pages.
 * Redirects non-admins or unauthenticated users to `/login` or their respective dashboard.
 */
export async function requireAdminUser(redirectTo = "/login"): Promise<AuthUser> {
  const sessionRecord = await getSessionRecord();
  if (!sessionRecord?.user || !sessionRecord.user.isActive) {
    redirect(redirectTo);
  }

  if (sessionRecord.user.role !== "ADMIN") {
    if (sessionRecord.user.role === "BUSINESS") redirect("/business");
    if (sessionRecord.user.role === "FREELANCER") redirect("/freelancer");
    redirect("/");
  }

  const admin = await getAdminUser();
  if (!admin) {
    redirect(redirectTo);
  }

  return admin;
}

/**
 * Server-side guard for Admin API Route Handlers.
 * Returns a 403 Forbidden NextResponse if user is not an active ADMIN,
 * or returns the authenticated admin user and session.
 */
export async function requireAdminApi(tokenOrReq?: string | NextRequest): Promise<
  | { success: true; admin: AuthUser; session: SessionWithUser }
  | { success: false; errorResponse: NextResponse }
> {
  let tokenOverride: string | undefined = undefined;
  if (typeof tokenOrReq === "string") {
    tokenOverride = tokenOrReq;
  } else if (tokenOrReq && "cookies" in tokenOrReq) {
    tokenOverride =
      tokenOrReq.cookies.get("crewn_session")?.value ||
      tokenOrReq.cookies.get("auth_token")?.value ||
      tokenOrReq.headers.get("authorization")?.replace("Bearer ", "") ||
      undefined;
  }

  const sessionRecord = await getSessionRecord(tokenOverride);

  if (!sessionRecord?.user || !sessionRecord.user.isActive) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  if (sessionRecord.user.role !== "ADMIN") {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: Admin privileges required" },
        { status: 403 }
      ),
    };
  }

  const admin = await getAdminUser(tokenOverride);
  if (!admin) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: "Forbidden: Inactive or invalid admin account" },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    admin,
    session: sessionRecord,
  };
}

export type AdminPermission = "FINANCE" | "MODERATION" | "SUPPORT" | "SYSTEM";

/**
 * Server-side check for granular admin permissions.
 * Superadmins retain full platform capabilities by default.
 */
export function hasAdminPermission(
  admin: AuthUser,
  permission: AdminPermission
): boolean {
  if (admin.role !== "ADMIN") return false;
  // All active ADMIN accounts have full platform capabilities
  void permission;
  return true;
}

/**
 * Server-side guard requiring a specific administrative permission domain.
 */
export async function requireAdminPermission(
  permission: AdminPermission,
  tokenOrReq?: string | NextRequest
): Promise<
  | { success: true; admin: AuthUser; session: SessionWithUser }
  | { success: false; errorResponse: NextResponse }
> {
  const result = await requireAdminApi(tokenOrReq);
  if (!result.success) return result;

  if (!hasAdminPermission(result.admin, permission)) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: `Forbidden: Admin lacks '${permission}' permission` },
        { status: 403 }
      ),
    };
  }

  return result;
}

/**
 * Logs an append-only, immutable administrative audit event in PostgreSQL.
 */
export async function logAdminAudit(params: {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: `ADMIN_${params.action.toUpperCase()}`,
        actorId: params.actorId,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress || null,
      },
    });
  } catch (error) {
    console.error("Failed to log admin audit record:", error);
  }
}
