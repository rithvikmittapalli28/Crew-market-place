/**
 * Admin Service: Platform Overview, User & Entity Management, Financial Operations, Health
 * 
 * All queries are backed by authoritative PostgreSQL and financial records.
 */

import { prisma } from "@/lib/prisma";
import { logAdminAudit } from "@/lib/auth/admin";
import type { UserRole } from "@/types";

export interface DashboardMetrics {
  counts: {
    totalUsers: number;
    activeBusinesses: number;
    activeFreelancers: number;
    activeProjects: number;
    activeContracts: number;
    executedContracts: number;
    pendingDeliverables: number;
    openDisputes: number;
    pendingModerationReports: number;
  };
  financial: {
    grossTransactionVolumeINR: number;
    platformFeesEarnedINR: number;
    paidInvoicesCount: number;
    paidInvoicesVolumeINR: number;
    pendingInvoicesVolumeINR: number;
    totalRefundsINR: number;
    totalPayoutsINR: number;
  };
  recentActivities: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actorName: string | null;
    actorEmail: string | null;
    createdAt: Date;
  }>;
  recentDisputes: Array<{
    id: string;
    projectId: string;
    projectTitle: string;
    initiatorName: string | null;
    status: string;
    createdAt: Date;
  }>;
}

/**
 * Aggregates real platform and financial metrics from PostgreSQL.
 */
export async function getAdminDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    totalUsers,
    activeBusinesses,
    activeFreelancers,
    activeProjects,
    activeContracts,
    executedContracts,
    pendingDeliverables,
    openDisputes,
    pendingModerationReports,
    completedPayments,
    platformFees,
    paidInvoices,
    pendingInvoices,
    refunds,
    payouts,
    recentLogs,
    recentDisputeRecords,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.freelancerProfile.count(),
    prisma.project.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "IN_REVIEW"] } } }),
    prisma.contract.count({ where: { status: "SENT" } }),
    prisma.contract.count({ where: { status: "EXECUTED" } }),
    prisma.deliverable.count({ where: { status: "SUBMITTED" } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "EVIDENCE_REQUESTED", "ESCALATED", "UNDER_MEDIATION"] } } }),
    prisma.moderationReport.count({ where: { status: "PENDING" } }),
    prisma.paymentTransaction.findMany({
      where: { status: "COMPLETED" },
      select: { amount: true },
    }),
    prisma.platformFee.findMany({
      select: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { status: "PAID" },
      select: { totalAmount: true },
    }),
    prisma.invoice.findMany({
      where: { status: "ISSUED" },
      select: { totalAmount: true },
    }),
    prisma.refund.findMany({
      where: { status: "COMPLETED" },
      select: { amount: true },
    }),
    prisma.payout.findMany({
      where: { status: "COMPLETED" },
      select: { amount: true },
    }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.dispute.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { title: true } },
        initiator: { select: { name: true } },
      },
    }),
  ]);

  const grossVolume = completedPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const feesEarned = platformFees.reduce((acc, f) => acc + Number(f.amount), 0);
  const paidInvVolume = paidInvoices.reduce((acc, inv) => acc + Number(inv.totalAmount), 0);
  const pendingInvVolume = pendingInvoices.reduce((acc, inv) => acc + Number(inv.totalAmount), 0);
  const refundsVolume = refunds.reduce((acc, r) => acc + Number(r.amount), 0);
  const payoutsVolume = payouts.reduce((acc, p) => acc + Number(p.amount), 0);

  return {
    counts: {
      totalUsers,
      activeBusinesses,
      activeFreelancers,
      activeProjects,
      activeContracts,
      executedContracts,
      pendingDeliverables,
      openDisputes,
      pendingModerationReports,
    },
    financial: {
      grossTransactionVolumeINR: grossVolume,
      platformFeesEarnedINR: feesEarned,
      paidInvoicesCount: paidInvoices.length,
      paidInvoicesVolumeINR: paidInvVolume,
      pendingInvoicesVolumeINR: pendingInvVolume,
      totalRefundsINR: refundsVolume,
      totalPayoutsINR: payoutsVolume,
    },
    recentActivities: recentLogs.map((l) => ({
      id: l.id,
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      actorName: l.actor?.name || null,
      actorEmail: l.actor?.email || null,
      createdAt: l.createdAt,
    })),
    recentDisputes: recentDisputeRecords.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      projectTitle: d.project.title,
      initiatorName: d.initiator.name,
      status: d.status,
      createdAt: d.createdAt,
    })),
  };
}

/**
 * Search and filter users for Admin User Management.
 */
export async function getAdminUsers(params: {
  search?: string;
  role?: string;
  status?: "active" | "suspended" | "all";
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.search?.trim()) {
    const s = params.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { id: s },
    ];
  }

  if (params.role && params.role !== "ALL") {
    where.role = params.role as UserRole;
  }

  if (params.status === "active") {
    where.isActive = true;
  } else if (params.status === "suspended") {
    where.isActive = false;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        role: true,
        isVerified: true,
        onboarded: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        businessMemberships: {
          select: {
            role: true,
            business: { select: { id: true, name: true, slug: true } },
          },
        },
        freelancerProfile: {
          select: { id: true, headline: true, isVerified: true },
        },
        _count: {
          select: {
            createdProjects: true,
            projectMemberships: true,
            contractParties: true,
            invoicesIssued: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Comprehensive User Detail for Admin Inspection.
 */
export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      businessMemberships: {
        include: { business: true },
      },
      freelancerProfile: {
        include: {
          skills: { include: { skill: true } },
          categories: { include: { category: true } },
        },
      },
      createdProjects: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { business: true },
      },
      contractParties: {
        take: 10,
        orderBy: { signedAt: "desc" },
        include: { contract: true },
      },
      invoicesIssued: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      disputesInitiated: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { project: { select: { title: true } } },
      },
      disputesDefended: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { project: { select: { title: true } } },
      },
      sessions: {
        take: 5,
        orderBy: { lastActivityAt: "desc" },
        select: {
          id: true,
          lastActivityAt: true,
          expiresAt: true,
          revokedAt: true,
          ipAddress: true,
          userAgent: true,
        },
      },
    },
  });

  return user;
}

/**
 * Suspends an account: marks isActive = false, immediately revokes all active sessions,
 * and logs an immutable audit event.
 */
export async function suspendUser(params: {
  userId: string;
  adminUserId: string;
  reason: string;
  ipAddress?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error("User not found");
  if (user.role === "ADMIN") throw new Error("Cannot suspend an Administrator account");

  const now = new Date();

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data: { isActive: false },
    }),
    prisma.session.updateMany({
      where: { userId: params.userId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.notification.create({
      data: {
        userId: params.userId,
        type: "ADMIN",
        title: "Account Suspended",
        body: `Your account has been suspended by platform administration. Reason: ${params.reason}`,
      },
    }),
  ]);

  await logAdminAudit({
    action: "SUSPEND_USER",
    entityType: "USER",
    entityId: params.userId,
    actorId: params.adminUserId,
    metadata: { reason: params.reason, email: user.email, name: user.name },
    ipAddress: params.ipAddress,
  });

  return updatedUser;
}

/**
 * Reactivates a suspended user account.
 */
export async function reactivateUser(params: {
  userId: string;
  adminUserId: string;
  reason?: string;
  ipAddress?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error("User not found");

  const updatedUser = await prisma.user.update({
    where: { id: params.userId },
    data: { isActive: true },
  });

  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: "ADMIN",
      title: "Account Reactivated",
      body: "Your account has been reactivated. You may now log in and access your workspace.",
    },
  });

  await logAdminAudit({
    action: "REACTIVATE_USER",
    entityType: "USER",
    entityId: params.userId,
    actorId: params.adminUserId,
    metadata: { reason: params.reason, email: user.email },
    ipAddress: params.ipAddress,
  });

  return updatedUser;
}

/**
 * System Health Assessment.
 */
export async function getAdminSystemHealth() {
  const startDb = Date.now();
  let dbStatus = "HEALTHY";
  let dbLatencyMs = 0;
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startDb;
  } catch (err: unknown) {
    dbStatus = "DEGRADED";
    dbError = err instanceof Error ? err.message : "Database connection failed";
  }

  const [
    unprocessedWebhooks,
    failedWebhooks,
    activeSessionsCount,
    recentAuditCount,
  ] = await Promise.all([
    prisma.webhookEvent.count({ where: { isProcessed: false } }),
    prisma.webhookEvent.count({ where: { processingStatus: "FAILED" } }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.activityLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return {
    status: dbStatus === "HEALTHY" && failedWebhooks === 0 ? "OPTIMAL" : "ATTENTION_REQUIRED",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        provider: "PostgreSQL",
        error: dbError,
      },
      webhooks: {
        status: failedWebhooks > 0 ? "FAILED_EVENTS_PRESENT" : "OPERATIONAL",
        unprocessedCount: unprocessedWebhooks,
        failedCount: failedWebhooks,
      },
      sessions: {
        activeSessions: activeSessionsCount,
      },
      audit: {
        eventsLast24h: recentAuditCount,
      },
      environment: {
        nodeVersion: process.version,
        env: process.env.NODE_ENV || "development",
      },
    },
  };
}
