import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { calculatePlatformFee } from "@/lib/payments/platform-fee";
import { generateInvoiceNumber, buildMilestoneInvoiceItems } from "@/lib/payments/invoice";
import { logProjectActivity } from "@/lib/projects/activity";
import { dispatchNotification } from "@/lib/notifications/service";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    // Allow admins or internal system calls
    if (user && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { eventId } = body;

    const whereClause = eventId
      ? { gatewayEventId: eventId }
      : {
          isProcessed: false,
          processingStatus: "FAILED",
          attempts: { lt: 5 },
        };

    const webhookRecord = await prisma.webhookEvent.findFirst({
      where: whereClause,
      orderBy: { createdAt: "asc" },
    });

    if (!webhookRecord) {
      return NextResponse.json({
        success: true,
        message: "No unprocessed or failed webhook events eligible for retry",
      });
    }

    logger.info({
      category: "WEBHOOK",
      message: `Retrying webhook event ${webhookRecord.gatewayEventId}`,
      details: { attempts: webhookRecord.attempts + 1 },
    });

    const event = JSON.parse(webhookRecord.payloadJson);
    const eventType = event.event as string;

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
              action: "ESCROW_LOCKED_VIA_WEBHOOK_RETRY",
              actorId: user?.id ?? null,
              metadata: { orderId, paymentId, eventId: webhookRecord.gatewayEventId },
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
    }

    // Mark event as successfully processed
    const updatedRecord = await prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        isProcessed: true,
        processingStatus: "COMPLETED",
        processingError: null,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Webhook event ${webhookRecord.gatewayEventId} reprocessed successfully`,
      event: {
        id: updatedRecord.id,
        gatewayEventId: updatedRecord.gatewayEventId,
        processingStatus: updatedRecord.processingStatus,
      },
    });
  } catch (error: unknown) {
    logger.error({
      category: "WEBHOOK",
      message: "Webhook retry error",
      details: error,
    });

    return NextResponse.json(
      { error: "Webhook retry failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
