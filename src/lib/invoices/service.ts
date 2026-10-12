import { prisma } from "@/lib/prisma";
import { InvoiceStatus, NotificationType } from "@prisma/client";
import { calculatePlatformFee } from "@/lib/payments/platform-fee";
import { logProjectActivity } from "@/lib/projects/activity";
import { dispatchNotification } from "@/lib/notifications/service";

export interface CreateMilestoneInvoiceParams {
  projectId: string;
  milestoneId: string;
  authorUserId: string;
}

export interface MarkInvoicePaidParams {
  invoiceId: string;
  paymentReference: string;
  paidAt?: Date;
}

/**
 * Concurrency-safe atomic invoice number generator.
 * Uses PostgreSQL row-level atomic upsert on InvoiceSequence to guarantee
 * unique, gapless, collision-free numbers even under high concurrency: INV-YYYYMM-XXXX
 */
export async function generateConcurrencySafeInvoiceNumber(): Promise<string> {
  const { generateInvoiceNumber } = await import("@/lib/payments/invoice");
  return generateInvoiceNumber();
}

/**
 * Validates invoice status state transitions.
 * Strict state machine:
 * DRAFT -> ISSUED -> PAID
 * ISSUED -> VOID
 */
export function isValidInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus
): boolean {
  if (from === to) return true;

  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["ISSUED", "VOID"],
    ISSUED: ["PAID", "VOID"],
    PAID: [], // Paid invoices are financially locked and immutable
    VOID: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Generates an authoritative invoice from an authorized project milestone.
 * All amounts are calculated server-side.
 */
export async function generateInvoiceFromMilestone(params: CreateMilestoneInvoiceParams) {
  const { projectId, milestoneId, authorUserId } = params;

  // 1. Fetch milestone with project and business
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      project: {
        include: {
          business: true,
          members: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found");
  }

  if (milestone.projectId !== projectId) {
    throw new Error("Milestone does not belong to the specified project");
  }

  // 2. Authorization check
  const isMember = milestone.project.members.some((m) => m.userId === authorUserId);
  const isBusinessOwnerOrManager = milestone.project.members.some(
    (m) => m.userId === authorUserId && ["OWNER", "MANAGER"].includes(m.role)
  );

  if (!isMember && !isBusinessOwnerOrManager) {
    throw new Error("Forbidden: You are not authorized to generate invoices for this project");
  }

  // 3. Check for existing active invoice for this milestone
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      milestoneId,
      status: { in: ["ISSUED", "PAID"] },
    },
    include: {
      business: true,
      recipient: true,
    },
  });

  if (existingInvoice) {
    return existingInvoice;
  }

  // 4. Server-calculated financials
  const grossAmount = Number(milestone.amount);
  const platformFee = calculatePlatformFee(grossAmount);
  const subtotalAmount = grossAmount;
  const platformFeeAmount = platformFee.feeAmount;
  const taxAmount = 0.0;
  const totalAmount = grossAmount;

  // Structured line items
  const items = [
    {
      description: `Project: ${milestone.project.title} — Milestone: ${milestone.title}`,
      quantity: 1,
      unitPrice: grossAmount,
      total: grossAmount,
    },
  ];

  if (platformFeeAmount > 0) {
    items.push({
      description: "Platform Processing & Escrow Service Fee (5%)",
      quantity: 1,
      unitPrice: platformFeeAmount,
      total: platformFeeAmount,
    });
  }

  // 5. Generate concurrency-safe invoice number
  const invoiceNumber = await generateConcurrencySafeInvoiceNumber();

  // Recipient is the client/project creator or assigned member
  const recipientId = milestone.project.createdById;
  const latestPayment = milestone.payments[0];

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      businessId: milestone.project.businessId,
      recipientId,
      projectId,
      milestoneId,
      milestonePaymentId: latestPayment?.id || null,
      subtotalAmount,
      platformFeeAmount,
      taxAmount,
      totalAmount,
      currency: "INR",
      status: "ISSUED",
      dueDate: milestone.dueDate || null,
      itemsJson: JSON.stringify(items),
    },
    include: {
      business: { select: { id: true, name: true, legalName: true, taxId: true, website: true, logoUrl: true } },
      recipient: { select: { id: true, name: true, email: true } },
      milestone: { select: { id: true, title: true, amount: true } },
    },
  });

  // 6. Activity logging
  logProjectActivity({
    projectId,
    entityType: "INVOICE",
    entityId: invoice.id,
    action: "INVOICE_GENERATED",
    actorId: authorUserId,
    metadata: {
      invoiceNumber,
      totalAmount,
      milestoneId,
    },
  }).catch(console.error);

  // 7. Dispatch notification to recipient
  dispatchNotification({
    userId: recipientId,
    type: "INVOICE" as NotificationType,
    title: `Invoice ${invoiceNumber} Issued`,
    body: `Invoice ${invoiceNumber} has been generated for milestone "${milestone.title}" (₹${totalAmount.toLocaleString("en-IN")}).`,
    linkUrl: `/invoices`,
  }).catch(console.error);

  return invoice;
}

/**
 * Authoritative payment marker.
 * Called ONLY from verified webhook or server payment state.
 * Never callable directly by the browser.
 */
export async function markInvoicePaid(params: MarkInvoicePaidParams) {
  const { invoiceId, paymentReference, paidAt = new Date() } = params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { business: true, recipient: true },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "PAID") {
    // Idempotent return
    return invoice;
  }

  if (invoice.status === "VOID") {
    throw new Error("Cannot pay a voided invoice");
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidAt,
      paymentReference,
    },
    include: {
      business: true,
      recipient: true,
    },
  });

  if (invoice.projectId) {
    logProjectActivity({
      projectId: invoice.projectId,
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "INVOICE_PAID",
      actorId: null,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        paymentReference,
        paidAt: paidAt.toISOString(),
      },
    }).catch(console.error);
  }

  // Dispatch real-time notification
  dispatchNotification({
    userId: invoice.recipientId,
    type: "INVOICE" as NotificationType,
    title: `Invoice ${invoice.invoiceNumber} Paid`,
    body: `Payment of ₹${Number(invoice.totalAmount).toLocaleString("en-IN")} for Invoice ${invoice.invoiceNumber} has been confirmed. Ref: ${paymentReference}`,
    linkUrl: `/invoices`,
  }).catch(console.error);

  return updatedInvoice;
}

/**
 * Voids an issued invoice before payment.
 */
export async function voidInvoice(invoiceId: string, userId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "PAID") {
    throw new Error("Cannot void a paid invoice. Financial records are immutable.");
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "VOID" },
  });

  if (invoice.projectId) {
    logProjectActivity({
      projectId: invoice.projectId,
      entityType: "INVOICE",
      entityId: invoice.id,
      action: "INVOICE_VOIDED",
      actorId: userId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    }).catch(console.error);
  }

  return updated;
}
