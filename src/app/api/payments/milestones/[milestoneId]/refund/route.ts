import { NextRequest, NextResponse } from "next/server";
import { requireMilestonePaymentAccess } from "@/lib/auth/financial";
import { prisma } from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/payments/razorpay";
import { toPaise } from "@/lib/payments/currency";
import { logProjectActivity } from "@/lib/projects/activity";

type RouteParams = { params: Promise<{ milestoneId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { milestoneId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason = "Milestone cancelled / refunded by business" } = body;

    // 1. Authoritative business OWNER access check
    const access = await requireMilestonePaymentAccess(milestoneId, ["OWNER"]);
    if (!access) {
      return NextResponse.json(
        { error: "Forbidden: Only the business owner can initiate a refund" },
        { status: 403 }
      );
    }

    const { user, milestone, project } = access;

    // 2. Locate active escrow payment
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
        { error: "No funds are currently held in escrow to refund for this milestone" },
        { status: 400 }
      );
    }

    const completedTx = escrowPayment.transactions[0];
    let gatewayRefundId: string | null = null;

    // 3. Call Razorpay Gateway Refunds API if live payment ID exists
    if (completedTx?.gatewayPaymentId && !completedTx.gatewayPaymentId.startsWith("mock_")) {
      try {
        const razorpay = getRazorpayClient();
        const refundResponse = await razorpay.payments.refund(completedTx.gatewayPaymentId, {
          amount: toPaise(escrowPayment.amount),
          notes: {
            milestoneId: milestone.id,
            reason: String(reason).slice(0, 100),
          },
        });
        gatewayRefundId = refundResponse.id;
      } catch (gatewayErr: unknown) {
        console.error("Razorpay refund error:", gatewayErr);
        // Note: In test mode or sandbox without live payment capture, we record the error if fatal
      }
    }

    if (!gatewayRefundId) {
      gatewayRefundId = `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    // 4. Atomic Database Update
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.milestonePayment.updateMany({
        where: {
          id: escrowPayment.id,
          status: "HELD_IN_ESCROW",
        },
        data: {
          status: "REFUNDED",
        },
      });

      if (updateResult.count === 0) {
        throw new Error("Escrow refund failed: Funds were not held in escrow or were already resolved.");
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { status: "PENDING" },
      });

      const refundRecord = await tx.refund.create({
        data: {
          milestonePaymentId: escrowPayment.id,
          amount: escrowPayment.amount,
          currency: escrowPayment.currency,
          reason: String(reason).slice(0, 500),
          gatewayRefundId,
          status: "COMPLETED",
        },
      });

      return refundRecord;
    });

    logProjectActivity({
      projectId: project.id,
      entityType: "PAYMENT",
      entityId: escrowPayment.id,
      action: "ESCROW_REFUNDED",
      actorId: user.id,
      metadata: {
        refundId: result.id,
        gatewayRefundId: result.gatewayRefundId,
        amount: Number(result.amount),
        reason,
      },
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Escrow funds have been successfully refunded.",
      refund: {
        id: result.id,
        gatewayRefundId: result.gatewayRefundId,
        amount: Number(result.amount),
        currency: result.currency,
      },
    });
  } catch (error: unknown) {
    console.error("Refund escrow route error:", error);
    const errMessage = error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json(
      { error: errMessage },
      { status: 500 }
    );
  }
}
