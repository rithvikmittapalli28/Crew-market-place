import { NextRequest, NextResponse } from "next/server";
import { requireMilestonePaymentAccess } from "@/lib/auth/financial";
import { prisma } from "@/lib/prisma";
import { calculatePlatformFee } from "@/lib/payments/platform-fee";
import { logProjectActivity } from "@/lib/projects/activity";

type RouteParams = { params: Promise<{ milestoneId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { milestoneId } = await params;

    // 1. Authoritative business access check
    const access = await requireMilestonePaymentAccess(milestoneId, ["OWNER", "MANAGER"]);
    if (!access) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to release escrow for this project" },
        { status: 403 }
      );
    }

    const { user, milestone, project } = access;

    // 2. Dispute check: Escrow release is frozen if there is an active dispute
    const activeDispute = await prisma.dispute.findFirst({
      where: {
        milestoneId,
        status: { in: ["OPEN", "UNDER_MEDIATION"] },
      },
    });

    if (activeDispute) {
      return NextResponse.json(
        { error: "Escrow release is frozen: An active dispute is currently pending on this milestone." },
        { status: 422 }
      );
    }

    // 3. Resolve recipient creator/freelancer
    let recipientUserId = milestone.freelancerId;

    if (!recipientUserId) {
      // Fallback: Find accepted freelancer on project
      const freelancerMember = await prisma.projectMember.findFirst({
        where: {
          projectId: project.id,
          role: { in: ["FREELANCER", "TEAM_MEMBER"] },
        },
        select: { userId: true },
      });
      recipientUserId = freelancerMember?.userId ?? null;
    }

    if (!recipientUserId) {
      return NextResponse.json(
        { error: "Cannot release escrow: No freelancer is assigned as beneficiary for this milestone." },
        { status: 422 }
      );
    }

    // 4. Find the active escrow payment
    const escrowPayment = await prisma.milestonePayment.findFirst({
      where: {
        milestoneId,
        status: "HELD_IN_ESCROW",
      },
      include: {
        transactions: {
          where: { status: "COMPLETED" },
          take: 1,
        },
      },
    });

    if (!escrowPayment) {
      return NextResponse.json(
        { error: "No funds are currently held in escrow for this milestone" },
        { status: 400 }
      );
    }

    const grossAmount = Number(escrowPayment.amount);
    const feeCalc = calculatePlatformFee(grossAmount);
    const netPayoutAmount = feeCalc.netFreelancerAmount;

    // 5. Atomic Concurrency Lock: Double-spend prevention
    const payoutRecord = await prisma.$transaction(async (tx) => {
      // Atomic conditional update: exactly one concurrent request can succeed
      const updateResult = await tx.milestonePayment.updateMany({
        where: {
          id: escrowPayment.id,
          status: "HELD_IN_ESCROW",
        },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("Escrow release failed: Funds were already released or refunded concurrently.");
      }

      // Transition Milestone to PAID
      await tx.milestone.update({
        where: { id: milestone.id },
        data: { status: "PAID" },
      });

      // Generate unique Payout reference
      const payoutRef = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Create Payout record (enforced @unique on milestonePaymentId)
      const payout = await tx.payout.create({
        data: {
          recipientId: recipientUserId,
          milestonePaymentId: escrowPayment.id,
          projectId: project.id,
          amount: netPayoutAmount,
          currency: escrowPayment.currency,
          status: "PENDING",
          payoutReference: payoutRef,
        },
      });

      // Notify recipient
      await tx.notification.create({
        data: {
          userId: recipientUserId,
          type: "PAYMENT",
          title: "Milestone Payment Released",
          body: `Escrow funds for milestone "${milestone.title}" have been approved and released! Payout amount: ₹${netPayoutAmount.toFixed(2)}.`,
          linkUrl: `/projects/${project.id}`,
        },
      });

      return payout;
    });

    logProjectActivity({
      projectId: project.id,
      entityType: "PAYMENT",
      entityId: escrowPayment.id,
      action: "ESCROW_RELEASED",
      actorId: user.id,
      metadata: {
        payoutId: payoutRecord.id,
        payoutReference: payoutRecord.payoutReference,
        recipientId: recipientUserId,
        grossAmount,
        netPayoutAmount,
      },
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Escrow funds successfully approved and released to freelancer.",
      payout: {
        id: payoutRecord.id,
        payoutReference: payoutRecord.payoutReference,
        amount: Number(payoutRecord.amount),
        currency: payoutRecord.currency,
        status: payoutRecord.status,
      },
    });
  } catch (error: unknown) {
    console.error("Release escrow route error:", error);
    const errMessage = error instanceof Error ? error.message : "Failed to release escrow";
    const isConflict = errMessage.includes("already released");
    return NextResponse.json(
      { error: errMessage },
      { status: isConflict ? 409 : 500 }
    );
  }
}
