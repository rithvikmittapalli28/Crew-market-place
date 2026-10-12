import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { calculatePlatformFee } from "@/lib/payments/platform-fee";
import { generateInvoiceNumber, buildMilestoneInvoiceItems } from "@/lib/payments/invoice";
import { logProjectActivity } from "@/lib/projects/activity";
import { dispatchNotification } from "@/lib/notifications/service";
import { logger } from "@/lib/logger";

interface RazorpayWebhookPayload {
  event?: string;
  event_id?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        method?: string;
        notes?: Record<string, string>;
        error_description?: string;
        [key: string]: unknown;
      };
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
        [key: string]: unknown;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
        [key: string]: unknown;
      };
    };
  };
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  let rawBody = "";
  let webhookRecord: { id: string; attempts: number } | null = null;
  try {
    // 1. Read exact raw text body before any parsing (critical for HMAC validation)
    rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-razorpay-signature header" },
        { status: 400 }
      );
    }

    // 2. Cryptographic HMAC-SHA256 signature verification
    const isValid = verifyWebhookSignature({ rawBody, signature });
    if (!isValid) {
      logger.warn({
        category: "SECURITY",
        message: "Invalid Razorpay webhook signature received",
      });
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    // 3. Parse JSON payload with defensive malformed payload handling
    let event: RazorpayWebhookPayload;
    try {
      event = JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      logger.warn({
        category: "WEBHOOK",
        message: "Malformed JSON in webhook request body",
      });
      return NextResponse.json(
        { error: "Malformed payload" },
        { status: 400 }
      );
    }

    const eventType = event.event as string;
    if (!eventType) {
      return NextResponse.json(
        { error: "Missing event type in payload" },
        { status: 400 }
      );
    }

    const gatewayEventId =
      event.event_id ||
      req.headers.get("x-razorpay-event-id") ||
      `evt_${eventType}_${Date.now()}`;

    // 4. Idempotency & Deduplication
    try {
      webhookRecord = await prisma.webhookEvent.create({
        data: {
          gatewayEventId,
          provider: "RAZORPAY",
          eventType,
          payloadJson: rawBody,
          isProcessed: false,
          processingStatus: "PROCESSING",
          attempts: 1,
        },
      });
    } catch (err: unknown) {
      // P2002: Unique constraint violation (Event already received)
      const prismaErr = err as { code?: string };
      if (prismaErr?.code === "P2002") {
        const existing = await prisma.webhookEvent.findUnique({
          where: { gatewayEventId },
        });

        if (existing?.isProcessed || existing?.processingStatus === "PROCESSING") {
          return NextResponse.json(
            { status: "ok", message: "Event already processed or processing" },
            { status: 200 }
          );
        }
        webhookRecord = existing;
      } else {
        throw err;
      }
    }

    // 5. Handle Supported Gateway Events
    if (eventType === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId && paymentId) {
        const txRecord = await prisma.paymentTransaction.findUnique({
          where: { gatewayOrderId: orderId },
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

        if (txRecord && txRecord.status !== "COMPLETED") {
          const mp = txRecord.milestonePayment;
          const milestone = mp?.milestone;
          const project = milestone?.project;
          const grossAmount = Number(txRecord.amount);

          if (mp && milestone && project) {
            await prisma.$transaction(async (tx) => {
              await tx.paymentTransaction.update({
                where: { id: txRecord.id },
                data: {
                  gatewayPaymentId: paymentId,
                  status: "COMPLETED",
                  paymentMethod: paymentEntity.method || null,
                },
              });

              const feeCalc = calculatePlatformFee(grossAmount);
              await tx.platformFee.upsert({
                where: { transactionId: txRecord.id },
                update: {
                  amount: feeCalc.feeAmount,
                  feePercentage: feeCalc.feePercentage,
                },
                create: {
                  transactionId: txRecord.id,
                  amount: feeCalc.feeAmount,
                  feePercentage: feeCalc.feePercentage,
                  currency: txRecord.currency,
                },
              });

              await tx.milestonePayment.update({
                where: { id: mp.id },
                data: {
                  status: "HELD_IN_ESCROW",
                  escrowHeldAt: new Date(),
                },
              });

              await tx.milestone.update({
                where: { id: milestone.id },
                data: { status: "ACTIVE" },
              });

              const invoiceNumber = await generateInvoiceNumber();
              const invoiceItems = buildMilestoneInvoiceItems({
                milestoneTitle: milestone.title,
                projectTitle: project.title,
                amount: grossAmount,
              });

              await tx.invoice.create({
                data: {
                  businessId: project.businessId,
                  recipientId: txRecord.payerId || project.createdById,
                  projectId: project.id,
                  milestonePaymentId: mp.id,
                  invoiceNumber,
                  totalAmount: txRecord.amount,
                  taxAmount: 0.0,
                  currency: txRecord.currency,
                  status: "PAID",
                  paidAt: new Date(),
                  itemsJson: JSON.stringify(invoiceItems),
                },
              });
            });

            logProjectActivity({
              projectId: project.id,
              entityType: "PAYMENT",
              entityId: mp.id,
              action: "ESCROW_LOCKED_VIA_WEBHOOK",
              actorId: null,
              metadata: { orderId, paymentId, eventId: gatewayEventId },
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
          }
        }
      }
    } else if (eventType === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;

      if (orderId) {
        await prisma.paymentTransaction.updateMany({
          where: { gatewayOrderId: orderId, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
    }

    // 6. Mark WebhookEvent as processed
    if (webhookRecord?.id) {
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          isProcessed: true,
          processingStatus: "COMPLETED",
          processedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error: unknown) {
    // 7. Durable Dead-Letter Queue recording on failure
    if (webhookRecord?.id) {
      try {
        const nextAttempts = (webhookRecord.attempts || 0) + 1;
        const isDeadLetter = nextAttempts >= 5;
        await prisma.webhookEvent.update({
          where: { id: webhookRecord.id },
          data: {
            processingStatus: isDeadLetter ? "DEAD_LETTER" : "FAILED",
            processingError: error instanceof Error ? error.message : String(error),
            attempts: nextAttempts,
          },
        });
      } catch (dbErr) {
        logger.error({
          category: "WEBHOOK",
          message: "Failed to persist DLQ status for failed webhook",
          details: dbErr,
        });
      }
    }

    // Retain internal details only in secure server-side logs
    logger.error({
      category: "WEBHOOK",
      message: "Razorpay webhook handler execution failed",
      details: error instanceof Error ? error.stack || error.message : String(error),
    });

    // Clean, generic error response without internal leakages
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }
}
