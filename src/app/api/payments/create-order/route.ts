import { NextRequest, NextResponse } from "next/server";
import { requireMilestonePaymentAccess } from "@/lib/auth/financial";
import { prisma } from "@/lib/prisma";
import { toPaise } from "@/lib/payments/currency";
import { getRazorpayClient } from "@/lib/payments/razorpay";
import { logProjectActivity } from "@/lib/projects/activity";
import { env } from "@/lib/env";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { milestoneId } = body;

    if (!milestoneId || typeof milestoneId !== "string") {
      return NextResponse.json(
        { error: "milestoneId is required" },
        { status: 400 }
      );
    }

    // 1. Authoritative server-side resolution of milestone, project, and business
    const access = await requireMilestonePaymentAccess(milestoneId, ["OWNER", "MANAGER"]);
    if (!access) {
      return NextResponse.json(
        { error: "Forbidden: You do not have financial access to fund this milestone" },
        { status: 403 }
      );
    }

    const { user, milestone, project, businessId } = access;

    // Rate limiting: 15 order creations per 5 minutes per user/IP
    const ip = getClientIp(req);
    const limitResult = await rateLimit(`create-order:${user.id}:${ip}`, 15, 5 * 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many payment orders initiated. Please wait a moment." },
        { status: 429 }
      );
    }

    // 2. State validation: Cannot fund paid, cancelled, or already funded milestones
    if (milestone.status === "PAID") {
      return NextResponse.json(
        { error: "This milestone has already been paid and completed" },
        { status: 400 }
      );
    }

    const existingEscrow = await prisma.milestonePayment.findFirst({
      where: {
        milestoneId,
        status: { in: ["HELD_IN_ESCROW", "RELEASED"] },
      },
    });

    if (existingEscrow) {
      return NextResponse.json(
        {
          error: `Milestone is already funded in escrow (status: ${existingEscrow.status})`,
        },
        { status: 400 }
      );
    }

    const amountNum = Number(milestone.amount);
    if (amountNum <= 0) {
      return NextResponse.json(
        { error: "Milestone amount must be greater than zero to initiate payment" },
        { status: 400 }
      );
    }

    const amountPaise = toPaise(milestone.amount);
    const currency = project.currency || "INR";

    // 3. Create Order via Razorpay Gateway
    const razorpay = getRazorpayClient();
    let order: { id: string; amount: number | string; currency: string };

    try {
      order = (await razorpay.orders.create({
        amount: amountPaise,
        currency,
        receipt: `m_${milestone.id.slice(0, 30)}`,
        notes: {
          projectId: project.id,
          milestoneId: milestone.id,
          businessId,
          payerId: user.id,
        },
      })) as { id: string; amount: number | string; currency: string };
    } catch (gatewayErr: unknown) {
      console.error("Razorpay order creation error:", gatewayErr);
      const errObj = gatewayErr as { error?: { description?: string }; message?: string };
      return NextResponse.json(
        {
          error: "Payment gateway rejected order creation",
          details: errObj?.error?.description || errObj?.message || "Gateway error",
        },
        { status: 502 }
      );
    }

    // 4. Record MilestonePayment and PaymentTransaction atomically
    const { milestonePayment, transaction } = await prisma.$transaction(async (tx) => {
      // Find or create pending MilestonePayment
      let mp = await tx.milestonePayment.findFirst({
        where: {
          milestoneId,
          status: "PENDING",
        },
      });

      if (!mp) {
        mp = await tx.milestonePayment.create({
          data: {
            milestoneId,
            projectId: project.id,
            businessId,
            amount: milestone.amount,
            currency,
            status: "PENDING",
          },
        });
      }

      const txRecord = await tx.paymentTransaction.create({
        data: {
          milestonePaymentId: mp.id,
          businessId,
          payerId: user.id,
          gatewayProvider: "RAZORPAY",
          gatewayOrderId: order.id,
          amount: milestone.amount,
          currency,
          status: "PENDING",
        },
      });

      return { milestonePayment: mp, transaction: txRecord };
    });

    logProjectActivity({
      projectId: project.id,
      entityType: "PAYMENT",
      entityId: milestonePayment.id,
      action: "ESCROW_ORDER_CREATED",
      actorId: user.id,
      metadata: {
        orderId: order.id,
        amount: amountNum,
        milestoneId: milestone.id,
      },
    }).catch(console.error);

    const keyId =
      env.RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      "";

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amountPaise,
      amount: amountNum,
      currency,
      keyId,
      milestonePaymentId: milestonePayment.id,
      transactionId: transaction.id,
    });
  } catch (error: unknown) {
    console.error("Create order route error:", error);
    return NextResponse.json(
      { error: "Internal server error creating payment order" },
      { status: 500 }
    );
  }
}
