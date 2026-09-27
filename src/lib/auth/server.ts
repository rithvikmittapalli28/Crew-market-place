import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionRecord } from "./session";
import type { UserRole, AuthUser, BusinessRole, ProjectMemberRole } from "@/types";

/**
 * Retrieves the full user record from PostgreSQL for the current authoritative database session.
 * Always loads the current User from the database for authorization decisions.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const sessionRecord = await getSessionRecord();
  if (!sessionRecord?.user || !sessionRecord.user.isActive) return null;

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
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      },
      freelancerProfile: {
        select: {
          id: true,
          headline: true,
          isVerified: true,
          hourlyRate: true,
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role as UserRole,
    isVerified: user.isVerified,
    onboarded: user.onboarded,
    businessMemberships: user.businessMemberships.map((m) => ({
      id: m.id,
      businessId: m.businessId,
      role: m.role as BusinessRole,
      business: m.business,
    })),
    freelancerProfile: user.freelancerProfile
      ? {
          id: user.freelancerProfile.id,
          headline: user.freelancerProfile.headline,
          isVerified: user.freelancerProfile.isVerified,
          hourlyRate: user.freelancerProfile.hourlyRate
            ? Number(user.freelancerProfile.hourlyRate)
            : null,
        }
      : null,
  };
}

/**
 * Requires an authenticated user session.
 * Redirects unauthenticated requests to `/login`.
 */
export async function requireAuthenticatedUser(redirectTo = "/login"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}

/**
 * Requires the user to have verified their email address.
 * Flow: registration -> limited authenticated state -> email verification -> onboarding -> normal application access.
 * Does not grant normal application access before email verification.
 */
export async function requireVerifiedUser(redirectTo = "/verify-email"): Promise<AuthUser> {
  const user = await requireAuthenticatedUser();
  if (!user.isVerified) {
    redirect(redirectTo);
  }
  return user;
}

/**
 * Requires the authenticated, email-verified user to have a specific role or set of roles.
 * Redirects to the appropriate dashboard or `/login` on unauthorized access.
 */
export async function requireRole(allowedRoles: UserRole | UserRole[]): Promise<AuthUser> {
  const user = await requireVerifiedUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(user.role)) {
    if (user.role === "BUSINESS") redirect("/business");
    if (user.role === "FREELANCER") redirect("/freelancer");
    if (user.role === "ADMIN") redirect("/admin");
    redirect("/");
  }

  return user;
}

/**
 * Requires the user to be a BUSINESS role, email-verified, and have completed business onboarding.
 */
export async function requireBusinessMember(): Promise<AuthUser> {
  const user = await requireRole("BUSINESS");
  if (!user.onboarded || !user.businessMemberships || user.businessMemberships.length === 0) {
    redirect("/onboarding/business");
  }
  return user;
}

/**
 * Requires the user to be an OWNER of an active Business entity.
 */
export async function requireBusinessOwner(): Promise<AuthUser & { businessId: string }> {
  const user = await requireBusinessMember();
  const ownerMembership = user.businessMemberships?.find((m) => m.role === "OWNER");

  if (!ownerMembership) {
    redirect("/business");
  }

  return {
    ...user,
    businessId: ownerMembership.businessId,
  };
}

/**
 * Requires the user to be a FREELANCER role, email-verified, and have completed freelancer onboarding.
 */
export async function requireFreelancer(): Promise<AuthUser & { freelancerProfileId: string }> {
  const user = await requireRole("FREELANCER");
  if (!user.onboarded || !user.freelancerProfile) {
    redirect("/onboarding/freelancer");
  }

  return {
    ...user,
    freelancerProfileId: user.freelancerProfile.id,
  };
}

/**
 * Checks whether the current session was authenticated recently (within maxAgeSeconds, default 15 minutes).
 * Used to protect sensitive operations: password changes, email changes, payout information, etc.
 */
export async function isRecentAuthentication(maxAgeSeconds = 900): Promise<boolean> {
  const sessionRecord = await getSessionRecord();
  if (!sessionRecord) return false;

  const secondsSinceReauth =
    (Date.now() - sessionRecord.lastReauthenticatedAt.getTime()) / 1000;

  return secondsSinceReauth <= maxAgeSeconds;
}

/**
 * Reusable server-side guard enforcing recent authentication for sensitive security/financial operations.
 * Throws an authorization error or redirects if authentication was not performed recently.
 */
export async function requireRecentAuthentication(
  maxAgeSeconds = 900
): Promise<{ user: AuthUser; sessionId: string }> {
  const sessionRecord = await getSessionRecord();
  if (!sessionRecord) {
    redirect("/login");
  }

  const secondsSinceReauth =
    (Date.now() - sessionRecord.lastReauthenticatedAt.getTime()) / 1000;

  if (secondsSinceReauth > maxAgeSeconds) {
    // Redirect to reauthentication challenge with safe return query
    redirect("/login?reauth=true");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return {
    user,
    sessionId: sessionRecord.id,
  };
}

/**
 * Verifies the authenticated user is a ProjectMember of the given project.
 * Optionally restricts access to specific ProjectMemberRole values.
 *
 * Also allows access if the user is a BUSINESS member of the project's owning business
 * (business always has oversight of their own projects).
 *
 * Returns the ProjectMember record on success.
 * Returns null if the user has no access (caller should return 403/404).
 */
export async function requireProjectMember(
  projectId: string,
  allowedRoles?: ProjectMemberRole[]
): Promise<{
  user: AuthUser;
  membership: { id: string; role: ProjectMemberRole } | null;
  isBusinessOverride: boolean;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // Check direct ProjectMember record
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { id: true, role: true },
  });

  if (membership) {
    if (allowedRoles && !allowedRoles.includes(membership.role as ProjectMemberRole)) {
      return null; // insufficient role
    }
    return { user, membership: { id: membership.id, role: membership.role as ProjectMemberRole }, isBusinessOverride: false };
  }

  // Business members always have oversight access to their own projects
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { businessId: true },
  });
  if (!project) return null;

  const businessMembership = user.businessMemberships?.find(
    (m) => m.businessId === project.businessId
  );
  if (businessMembership) {
    // Business oversight: if allowedRoles specified, treat business member as OWNER
    if (allowedRoles && !allowedRoles.includes("OWNER" as ProjectMemberRole)) {
      return null;
    }
    return { user, membership: null, isBusinessOverride: true };
  }

  return null;
}

/**
 * Verifies the authenticated user is a BusinessMember of the business that owns the project.
 * Used for operations that are business-only (e.g., creating milestones, reviewing deliverables).
 * Returns the business membership record or null if unauthorized.
 */
export async function requireBusinessProjectAccess(
  projectId: string,
  requiredRoles?: BusinessRole[]
): Promise<{
  user: AuthUser;
  businessId: string;
  businessRole: BusinessRole;
} | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { businessId: true },
  });
  if (!project) return null;

  const membership = user.businessMemberships?.find(
    (m) => m.businessId === project.businessId
  );
  if (!membership) return null;

  if (requiredRoles && !requiredRoles.includes(membership.role)) return null;

  return {
    user,
    businessId: project.businessId,
    businessRole: membership.role,
  };
}
