/**
 * Moderation & Platform Safety Service
 * 
 * Handles user reports, content moderation queues, and administrative moderation decisions.
 */

import { prisma } from "@/lib/prisma";
import { logAdminAudit } from "@/lib/auth/admin";
import { suspendUser } from "@/lib/admin/service";
import type { ModerationStatus } from "@/types";

export interface SubmitReportInput {
  reporterId: string;
  targetType: "USER" | "CREATOR_PROFILE" | "PORTFOLIO_ITEM" | "SERVICE" | "PROJECT";
  targetId: string;
  category?: "SPAM" | "FRAUD" | "HARASSMENT" | "INAPPROPRIATE_CONTENT" | "IP_INFRINGEMENT" | "OTHER" | string;
  reason: string;
  evidenceJson?: string | null;
  ipAddress?: string | null;
}

export interface ReviewReportInput {
  reportId: string;
  adminUserId: string;
  status: ModerationStatus;
  actionTaken?: "SUSPEND_USER" | "WARNING" | "NONE" | "CONTENT_REMOVED" | string;
  adminNotes?: string;
  ipAddress?: string | null;
}

/**
 * Submits a new moderation report from a user.
 */
export async function submitReport(input: SubmitReportInput) {
  if (!input.reason.trim()) {
    throw new Error("Reason is required to submit a report");
  }

  // Prevent self-reporting
  if (input.targetType === "USER" && input.targetId === input.reporterId) {
    throw new Error("You cannot submit a report against your own account");
  }

  const category = input.category || "POLICY_VIOLATION";

  const report = await prisma.moderationReport.create({
    data: {
      reporterId: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      category,
      reason: input.reason,
      evidenceJson: input.evidenceJson || null,
      status: "PENDING",
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "MODERATION_REPORT",
      entityId: report.id,
      action: "REPORT_SUBMITTED",
      actorId: input.reporterId,
      metadataJson: JSON.stringify({
        targetType: input.targetType,
        targetId: input.targetId,
        category,
      }),
      ipAddress: input.ipAddress || null,
    },
  });

  return report;
}

/**
 * Lists moderation reports for administrator triage.
 */
export async function listReports(params: {
  status?: string;
  targetType?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.status && params.status !== "ALL") {
    where.status = params.status as ModerationStatus;
  }

  if (params.targetType && params.targetType !== "ALL") {
    where.targetType = params.targetType;
  }

  const [reports, total] = await Promise.all([
    prisma.moderationReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: { id: true, name: true, email: true, role: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.moderationReport.count({ where }),
  ]);

  return {
    reports,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Detailed report inspection.
 */
export async function getReportDetail(reportId: string) {
  const report = await prisma.moderationReport.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: { id: true, name: true, email: true, role: true },
      },
      reviewedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return report;
}

/**
 * Reviews and resolves a moderation report.
 */
export async function reviewReport(input: ReviewReportInput) {
  const report = await prisma.moderationReport.findUnique({
    where: { id: input.reportId },
  });

  if (!report) throw new Error("Report not found");

  const now = new Date();

  // If suspension action is chosen and target is a user, execute suspension
  if (input.actionTaken === "SUSPEND_USER") {
    let targetUserId = report.targetId;

    if (report.targetType === "CREATOR_PROFILE") {
      const profile = await prisma.freelancerProfile.findUnique({
        where: { id: report.targetId },
        select: { userId: true },
      });
      if (profile) targetUserId = profile.userId;
    }

    if (targetUserId) {
      await suspendUser({
        userId: targetUserId,
        adminUserId: input.adminUserId,
        reason: `Moderation report #${report.id}: ${input.adminNotes || report.reason}`,
        ipAddress: input.ipAddress,
      });
    }
  }

  const updatedReport = await prisma.moderationReport.update({
    where: { id: input.reportId },
    data: {
      status: input.status,
      actionTaken: input.actionTaken || report.actionTaken,
      adminNotes: input.adminNotes || report.adminNotes,
      reviewedById: input.adminUserId,
      reviewedAt: now,
    },
  });

  await logAdminAudit({
    action: "MODERATION_DECISION",
    entityType: "MODERATION_REPORT",
    entityId: report.id,
    actorId: input.adminUserId,
    metadata: {
      status: input.status,
      actionTaken: input.actionTaken,
      targetType: report.targetType,
      targetId: report.targetId,
      adminNotes: input.adminNotes,
    },
    ipAddress: input.ipAddress,
  });

  return updatedReport;
}
