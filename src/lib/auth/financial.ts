import { getCurrentUser } from "./server";
import { prisma } from "@/lib/prisma";
import type { AuthUser, BusinessRole } from "@/types";

export interface BusinessFinancialAccessResult {
  user: AuthUser;
  businessId: string;
  businessRole: BusinessRole;
}

/**
 * Server-side guard: Requires user to be an OWNER or MANAGER of the specified business.
 * Strictly isolates financial operations (creating payment orders, releasing escrow, viewing invoices).
 */
export async function requireBusinessFinancialAccess(
  businessId: string,
  allowedRoles: BusinessRole[] = ["OWNER", "MANAGER"]
): Promise<BusinessFinancialAccessResult | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS") return null;

  const membership = user.businessMemberships?.find((m) => m.businessId === businessId);
  if (!membership || !allowedRoles.includes(membership.role)) {
    return null;
  }

  return {
    user,
    businessId,
    businessRole: membership.role,
  };
}

/**
 * Server-side guard: Resolves milestone and project server-side, verifying business financial access.
 * Guarantees zero client-side parameter tampering for payment operations.
 */
export async function requireMilestonePaymentAccess(
  milestoneId: string,
  allowedRoles: BusinessRole[] = ["OWNER", "MANAGER"]
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS") return null;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          businessId: true,
          currency: true,
          status: true,
        },
      },
      freelancer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!milestone) return null;

  const financialAccess = await requireBusinessFinancialAccess(
    milestone.project.businessId,
    allowedRoles
  );
  if (!financialAccess) return null;

  return {
    user,
    milestone,
    project: milestone.project,
    businessId: milestone.project.businessId,
  };
}

/**
 * Server-side guard: Verifies freelancer identity and restricts access exclusively to their own earnings and payouts.
 */
export async function requireFreelancerEarningsAccess(targetUserId?: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "FREELANCER") return null;

  if (targetUserId && targetUserId !== user.id) {
    return null; // Cross-user earnings access strictly forbidden
  }

  return { user };
}
