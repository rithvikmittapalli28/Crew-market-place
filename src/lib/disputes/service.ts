/**
 * Dispute System Service & State Machine
 * 
 * Manages the complete lifecycle of disputes between businesses and freelancers:
 * OPEN -> UNDER_REVIEW -> EVIDENCE_REQUESTED -> ESCALATED -> RESOLVED / CLOSED
 * Connects authoritative dispute resolutions directly to escrow and milestone financial states.
 */

import { prisma } from "@/lib/prisma";
import { logAdminAudit } from "@/lib/auth/admin";
import type { DisputeStatus } from "@/types";

export interface CreateDisputeInput {
  projectId: string;
  milestoneId?: string | null;
  contractId?: string | null;
  initiatorId: string;
  category: string;
  reason: string;
  messageContent?: string;
  attachmentFileId?: string;
  ipAddress?: string | null;
}

export interface ResolveDisputeInput {
  disputeId: string;
  adminUserId: string;
  resolutionAction: "RELEASE_ESCROW" | "REFUND_BUYER" | "PARTIAL_SPLIT" | "CLOSE_NO_ACTION";
  resolutionText: string;
  adminNotes?: string;
  refundAmount?: number;
  releaseAmount?: number;
  ipAddress?: string | null;
}

/**
 * Creates a formal dispute between project parties.
 */
export async function createDispute(input: CreateDisputeInput) {
  // 1. Verify project exists and load members
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: {
      business: {
        include: {
          members: { where: { role: "OWNER" } },
        },
      },
      members: true,
    },
  });

  if (!project) throw new Error("Project not found");

  // Verify initiator is a participant in this project
  const isCreator = project.createdById === input.initiatorId;
  const isBusinessOwner = project.business.members.some((m) => m.userId === input.initiatorId);
  const isMember = project.members.some((m) => m.userId === input.initiatorId);

  if (!isCreator && !isBusinessOwner && !isMember) {
    throw new Error("Unauthorized: Only project participants can open a dispute");
  }

  // 2. Resolve respondent automatically
  let respondentId: string | null = null;

  if (input.milestoneId) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: input.milestoneId },
    });
    if (milestone?.freelancerId && milestone.freelancerId !== input.initiatorId) {
      respondentId = milestone.freelancerId;
    }
  }

  if (!respondentId) {
    if (isCreator || isBusinessOwner) {
      // Initiator is Business -> find assigned freelancer
      const freelancerMember = project.members.find((m) => m.role === "FREELANCER");
      respondentId = freelancerMember?.userId || null;
    } else {
      // Initiator is Freelancer -> respondent is Business Creator / Owner
      respondentId = project.createdById || project.business.members[0]?.userId || null;
    }
  }

  if (!respondentId) {
    throw new Error("Unable to identify dispute respondent for this project");
  }

  if (respondentId === input.initiatorId) {
    throw new Error("Dispute initiator and respondent cannot be the same user");
  }

  // 3. Create Dispute & initial message in transaction
  const dispute = await prisma.$transaction(async (tx) => {
    const d = await tx.dispute.create({
      data: {
        projectId: input.projectId,
        milestoneId: input.milestoneId || null,
        contractId: input.contractId || null,
        initiatorId: input.initiatorId,
        respondentId,
        category: input.category,
        reason: input.reason,
        status: "OPEN",
      },
    });

    // Create initial message if provided
    const content = input.messageContent || input.reason;
    await tx.disputeMessage.create({
      data: {
        disputeId: d.id,
        senderId: input.initiatorId,
        content,
        attachmentFileId: input.attachmentFileId || null,
      },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        projectId: input.projectId,
        entityType: "DISPUTE",
        entityId: d.id,
        action: "DISPUTE_OPENED",
        actorId: input.initiatorId,
        metadataJson: JSON.stringify({
          category: input.category,
          milestoneId: input.milestoneId,
          contractId: input.contractId,
        }),
        ipAddress: input.ipAddress || null,
      },
    });

    // Notify respondent
    await tx.notification.create({
      data: {
        userId: respondentId,
        type: "DISPUTE",
        title: "Dispute Opened",
        body: `A dispute was opened on project "${project.title}". Reason: ${input.category}`,
        linkUrl: `/projects/${project.id}?tab=disputes`,
      },
    });

    return d;
  });

  return dispute;
}

/**
 * Retrieves a single dispute with authorization checks.
 */
export async function getDispute(disputeId: string, currentUserId: string, isAdmin = false) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          businessId: true,
          business: { select: { id: true, name: true, logoUrl: true } },
          members: { select: { userId: true, role: true } },
        },
      },
      milestone: {
        include: {
          payments: true,
        },
      },
      contract: {
        select: {
          id: true,
          title: true,
          status: true,
          totalAmount: true,
        },
      },
      initiator: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      respondent: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      resolvedBy: {
        select: { id: true, name: true, email: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
          attachmentFile: {
            select: { id: true, fileName: true, mimeType: true, fileSize: true, storageKey: true },
          },
        },
      },
    },
  });

  if (!dispute) return null;

  if (!isAdmin) {
    const isParty = dispute.initiatorId === currentUserId || dispute.respondentId === currentUserId;
    const isMember = dispute.project.members.some((m) => m.userId === currentUserId);
    if (!isParty && !isMember) {
      return null; // Unauthorized
    }
  }

  return dispute;
}

/**
 * Lists disputes for a user or for platform administrators.
 */
export async function listDisputes(params: {
  userId?: string;
  projectId?: string;
  status?: string;
  page?: number;
  limit?: number;
  isAdmin?: boolean;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (!params.isAdmin && params.userId) {
    where.OR = [
      { initiatorId: params.userId },
      { respondentId: params.userId },
    ];
  }

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  if (params.status && params.status !== "ALL") {
    where.status = params.status as DisputeStatus;
  }

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, title: true } },
        milestone: { select: { id: true, title: true, amount: true } },
        initiator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        respondent: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    disputes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Adds a message or evidence attachment to an existing dispute.
 */
export async function addDisputeMessage(params: {
  disputeId: string;
  senderId: string;
  content: string;
  attachmentFileId?: string | null;
  isAdmin?: boolean;
}) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: params.disputeId },
    include: { project: { select: { id: true, title: true } } },
  });

  if (!dispute) throw new Error("Dispute not found");

  if (!params.isAdmin) {
    const isParty = dispute.initiatorId === params.senderId || dispute.respondentId === params.senderId;
    if (!isParty) throw new Error("Unauthorized: Only dispute participants can send messages");
  }

  const message = await prisma.disputeMessage.create({
    data: {
      disputeId: params.disputeId,
      senderId: params.senderId,
      content: params.content,
      attachmentFileId: params.attachmentFileId || null,
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      attachmentFile: {
        select: { id: true, fileName: true, mimeType: true, fileSize: true, storageKey: true },
      },
    },
  });

  // If evidence was requested, receiving a message moves it back under review
  if (dispute.status === "EVIDENCE_REQUESTED") {
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: "UNDER_REVIEW" },
    });
  }

  // Notify counterparty
  const recipientId = params.senderId === dispute.initiatorId ? dispute.respondentId : dispute.initiatorId;
  await prisma.notification.create({
    data: {
      userId: recipientId,
      type: "DISPUTE",
      title: "New Dispute Message",
      body: `New message on dispute for "${dispute.project.title}"`,
      linkUrl: `/projects/${dispute.projectId}?tab=disputes`,
    },
  });

  return message;
}

/**
 * Updates dispute status (Admin Triage: UNDER_REVIEW, EVIDENCE_REQUESTED, ESCALATED, etc.)
 */
export async function updateDisputeStatus(params: {
  disputeId: string;
  status: DisputeStatus;
  adminUserId: string;
  adminNotes?: string;
  ipAddress?: string | null;
}) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: params.disputeId },
    include: { project: true },
  });

  if (!dispute) throw new Error("Dispute not found");

  const updated = await prisma.dispute.update({
    where: { id: params.disputeId },
    data: {
      status: params.status,
      adminNotes: params.adminNotes !== undefined ? params.adminNotes : dispute.adminNotes,
    },
  });

  await logAdminAudit({
    action: "DISPUTE_STATUS_CHANGED",
    entityType: "DISPUTE",
    entityId: params.disputeId,
    actorId: params.adminUserId,
    metadata: { previousStatus: dispute.status, newStatus: params.status, notes: params.adminNotes },
    ipAddress: params.ipAddress,
  });

  // Notify both parties
  const notifBody = `Dispute status updated to ${params.status} by platform administration.`;
  await prisma.notification.createMany({
    data: [
      {
        userId: dispute.initiatorId,
        type: "DISPUTE",
        title: "Dispute Status Updated",
        body: notifBody,
        linkUrl: `/projects/${dispute.projectId}?tab=disputes`,
      },
      {
        userId: dispute.respondentId,
        type: "DISPUTE",
        title: "Dispute Status Updated",
        body: notifBody,
        linkUrl: `/projects/${dispute.projectId}?tab=disputes`,
      },
    ],
  });

  return updated;
}

/**
 * Resolves a dispute with transactional financial settlement.
 * 
 * Supports:
 * - RELEASE_ESCROW: releases escrow to freelancer/beneficiary (PAID milestone, RELEASED payment)
 * - REFUND_BUYER: refunds escrow to buyer (REFUNDED payment, refund record created)
 * - PARTIAL_SPLIT: splits escrow between buyer and creator
 * - CLOSE_NO_ACTION: closes dispute without modifying escrow balance
 */
export async function resolveDispute(input: ResolveDisputeInput) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: input.disputeId },
    include: {
      milestone: {
        include: { payments: true },
      },
      project: true,
      initiator: true,
      respondent: true,
    },
  });

  if (!dispute) throw new Error("Dispute not found");

  const now = new Date();
  let resolvedStatus: DisputeStatus = "CLOSED";

  if (input.resolutionAction === "RELEASE_ESCROW") {
    resolvedStatus = "RESOLVED_CREATOR";
  } else if (input.resolutionAction === "REFUND_BUYER") {
    resolvedStatus = "RESOLVED_BUYER";
  } else if (input.resolutionAction === "PARTIAL_SPLIT") {
    resolvedStatus = "PARTIAL_RESOLUTION";
  } else {
    resolvedStatus = "CLOSED";
  }

  // Execute resolution in database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Financial adjustments if milestone payment is linked
    if (dispute.milestone && dispute.milestone.payments.length > 0) {
      const activePayment = dispute.milestone.payments.find(
        (p) => p.status === "HELD_IN_ESCROW" || p.status === "PENDING"
      ) || dispute.milestone.payments[0];

      if (activePayment) {
        if (input.resolutionAction === "RELEASE_ESCROW") {
          // Release escrow to freelancer
          await tx.milestonePayment.update({
            where: { id: activePayment.id },
            data: {
              status: "RELEASED",
              releasedAt: now,
            },
          });

          await tx.milestone.update({
            where: { id: dispute.milestoneId! },
            data: { status: "PAID" },
          });

          // Create Payout record if freelancer profile exists
          const recipientId = dispute.milestone.freelancerId || dispute.respondentId;
          await tx.payout.create({
            data: {
              recipientId,
              milestonePaymentId: activePayment.id,
              projectId: dispute.projectId,
              amount: activePayment.amount,
              currency: activePayment.currency,
              status: "COMPLETED",
              payoutReference: `payout_disp_${dispute.id.slice(0, 8)}`,
              processedAt: now,
            },
          });
        } else if (input.resolutionAction === "REFUND_BUYER") {
          // Refund escrow to business
          await tx.milestonePayment.update({
            where: { id: activePayment.id },
            data: {
              status: "REFUNDED",
            },
          });

          await tx.refund.create({
            data: {
              milestonePaymentId: activePayment.id,
              amount: activePayment.amount,
              currency: activePayment.currency,
              reason: `Dispute ${dispute.id} resolved in favor of buyer: ${input.resolutionText}`,
              status: "COMPLETED",
              gatewayRefundId: `ref_disp_${dispute.id.slice(0, 8)}`,
            },
          });
        } else if (input.resolutionAction === "PARTIAL_SPLIT") {
          const refundAmt = input.refundAmount || Number(activePayment.amount) / 2;
          const releaseAmt = input.releaseAmount || (Number(activePayment.amount) - refundAmt);

          await tx.milestonePayment.update({
            where: { id: activePayment.id },
            data: {
              status: "RELEASED",
              releasedAt: now,
            },
          });

          // Partial refund to buyer
          await tx.refund.create({
            data: {
              milestonePaymentId: activePayment.id,
              amount: refundAmt,
              currency: activePayment.currency,
              reason: `Dispute split resolution: ${input.resolutionText}`,
              status: "COMPLETED",
              gatewayRefundId: `ref_split_${dispute.id.slice(0, 8)}`,
            },
          });

          // Partial payout to creator
          const recipientId = dispute.milestone.freelancerId || dispute.respondentId;
          await tx.payout.create({
            data: {
              recipientId,
              milestonePaymentId: activePayment.id,
              projectId: dispute.projectId,
              amount: releaseAmt,
              currency: activePayment.currency,
              status: "COMPLETED",
              payoutReference: `payout_split_${dispute.id.slice(0, 8)}`,
              processedAt: now,
            },
          });
        }
      }
    }

    // 2. Update Dispute Record
    const updatedDispute = await tx.dispute.update({
      where: { id: input.disputeId },
      data: {
        status: resolvedStatus,
        resolution: input.resolutionText,
        adminNotes: input.adminNotes || dispute.adminNotes,
        resolutionAction: input.resolutionAction,
        refundAmount: input.refundAmount ? input.refundAmount : null,
        releaseAmount: input.releaseAmount ? input.releaseAmount : null,
        resolvedAt: now,
        resolvedById: input.adminUserId,
      },
    });

    // 3. System Dispute Message
    await tx.disputeMessage.create({
      data: {
        disputeId: input.disputeId,
        senderId: input.adminUserId,
        content: `⚖️ Official Dispute Resolution (${input.resolutionAction}):\n\n${input.resolutionText}`,
      },
    });

    // 4. Activity Log
    await tx.activityLog.create({
      data: {
        projectId: dispute.projectId,
        entityType: "DISPUTE",
        entityId: dispute.id,
        action: `DISPUTE_RESOLVED_${input.resolutionAction}`,
        actorId: input.adminUserId,
        metadataJson: JSON.stringify({
          action: input.resolutionAction,
          refundAmount: input.refundAmount,
          releaseAmount: input.releaseAmount,
          resolution: input.resolutionText,
        }),
        ipAddress: input.ipAddress || null,
      },
    });

    // 5. Real-time Notifications to both parties
    const resolutionMsg = `Dispute on "${dispute.project.title}" has been resolved (${input.resolutionAction}). Resolution: ${input.resolutionText}`;
    await tx.notification.createMany({
      data: [
        {
          userId: dispute.initiatorId,
          type: "DISPUTE",
          title: "Dispute Resolved",
          body: resolutionMsg,
          linkUrl: `/projects/${dispute.projectId}?tab=disputes`,
        },
        {
          userId: dispute.respondentId,
          type: "DISPUTE",
          title: "Dispute Resolved",
          body: resolutionMsg,
          linkUrl: `/projects/${dispute.projectId}?tab=disputes`,
        },
      ],
    });

    return updatedDispute;
  });

  return result;
}
