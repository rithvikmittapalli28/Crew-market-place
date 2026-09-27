import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { calculatePlatformFee } from "@/lib/payments/platform-fee";
import { generateInvoiceNumber, buildMilestoneInvoiceItems } from "@/lib/payments/invoice";
import { logProjectActivity } from "@/lib/projects/activity";
import { dispatchNotification } from "@/lib/notifications/service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required payment verification parameters" },
        { status: 400 }
      );
    }

    // 1. Cryptographic HMAC-SHA256 signature verification
    const isValidSignature = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Payment verification failed: Invalid cryptographic signature" },
        { status: 400 }
      );
    }

    // 2. Fetch transaction and verify business authorization
    const existingTx = await prisma.paymentTransaction.findUnique({
      where: { gatewayOrderId: razorpay_order_id },
      include: {
        milestonePayment: {
          include: {
            milestone: {
              include: { project: true },
            },
          },
        },
      },
    });

    if (!existingTx) {
      return NextResponse.json(
        { error: "Transaction record not found for this gateway order" },
        { status: 404 }
      );
    }

    // Idempotency: If already completed, return success immediately
    if (existingTx.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        message: "Payment already verified and locked in escrow",
        milestonePaymentId: existingTx.milestonePaymentId,
      });
    }

    // Authorization: User must be a member of the paying business
    const userBusinessIds = (user.businessMemberships ?? []).map((m) => m.businessId);
    if (existingTx.businessId && !userBusinessIds.includes(existingTx.businessId)) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to confirm payments for this business" },
        { status: 403 }
      );
    }

    const milestonePayment = existingTx.milestonePayment;
    if (!milestonePayment || !milestonePayment.milestone) {
      return NextResponse.json(
        { error: "Associated milestone payment record is missing" },
        { status: 404 }
      );
    }

    const milestone = milestonePayment.milestone;
    const project = milestone.project;
    const grossAmount = Number(existingTx.amount);

    // 3. Atomic Database Transaction: Lock escrow, record fee, generate invoice
    const result = await prisma.$transaction(async (tx) => {
      // A. Update PaymentTransaction
      const updatedTx = await tx.paymentTransaction.update({
        where: { id: existingTx.id },
        data: {
          gatewayPaymentId: razorpay_payment_id,
          status: "COMPLETED",
        },
      });

      // B. Record Platform Fee (guaranteed unique by transactionId)
      const feeCalc = calculatePlatformFee(grossAmount);
      await tx.platformFee.upsert({
        where: { transactionId: existingTx.id },
        update: {
          amount: feeCalc.feeAmount,
          feePercentage: feeCalc.feePercentage,
          currency: existingTx.currency,
        },
        create: {
          transactionId: existingTx.id,
          amount: feeCalc.feeAmount,
          feePercentage: feeCalc.feePercentage,
          currency: existingTx.currency,
        },
      });

      // C. Transition MilestonePayment to HELD_IN_ESCROW
      const updatedMp = await tx.milestonePayment.update({
        where: { id: milestonePayment.id },
        data: {
          status: "HELD_IN_ESCROW",
          escrowHeldAt: new Date(),
        },
      });

      // D. Transition Milestone to ACTIVE
      await tx.milestone.update({
        where: { id: milestone.id },
        data: {
          status: "ACTIVE",
        },
      });

      // E. Generate Automated Billing Invoice
      const invoiceNumber = await generateInvoiceNumber();
      const invoiceItems = buildMilestoneInvoiceItems({
        milestoneTitle: milestone.title,
        projectTitle: project.title,
        amount: grossAmount,
      });

      const invoice = await tx.invoice.create({
        data: {
          businessId: project.businessId,
          recipientId: existingTx.payerId || user.id,
          projectId: project.id,
          milestonePaymentId: milestonePayment.id,
          invoiceNumber,
          totalAmount: existingTx.amount,
          taxAmount: 0.0,
          currency: existingTx.currency,
          status: "PAID",
          paidAt: new Date(),
          itemsJson: JSON.stringify(invoiceItems),
        },
      });

      return {
        transaction: updatedTx,
        milestonePayment: updatedMp,
        invoice,
      };
    });

    // 4. Log project activity
    logProjectActivity({
      projectId: project.id,
      entityType: "PAYMENT",
      entityId: milestonePayment.id,
      action: "ESCROW_LOCKED",
      actorId: user.id,
      metadata: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: grossAmount,
        invoiceNumber: result.invoice.invoiceNumber,
      },
    }).catch(console.error);

    if (milestone.freelancerId) {
      dispatchNotification({
        userId: milestone.freelancerId,
        type: "MILESTONE",
        title: "Milestone Funded in Escrow",
        body: `Milestone "${milestone.title}" has been funded in escrow. You may now begin work!`,
        linkUrl: `/projects/${project.id}`,
      }).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: "Payment successfully verified and locked in escrow",
      milestonePaymentId: result.milestonePayment.id,
      invoiceNumber: result.invoice.invoiceNumber,
      escrowStatus: "HELD_IN_ESCROW",
    });
  } catch (error: unknown) {
    console.error("Payment verify route error:", error);
    return NextResponse.json(
      { error: "Internal server error verifying payment" },
      { status: 500 }
    );
  }
}
