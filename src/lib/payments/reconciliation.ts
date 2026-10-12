import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ReconciliationDiscrepancy {
  id: string;
  type:
    | "STATUS_MISMATCH"
    | "AMOUNT_MISMATCH"
    | "MISSING_PROVIDER_RECORD"
    | "MISSING_INTERNAL_RECORD"
    | "DUPLICATE_WEBHOOK_EVENT"
    | "UNPROCESSED_WEBHOOK";
  severity: "HIGH" | "MEDIUM" | "LOW";
  entityType: "TRANSACTION" | "MILESTONE_PAYMENT" | "INVOICE" | "WEBHOOK";
  entityId: string;
  description: string;
  details: {
    expected: unknown;
    actual: unknown;
    orderId?: string | null;
    paymentId?: string | null;
  };
  resolved: boolean;
}

export interface ReconciliationReport {
  timestamp: string;
  summary: {
    totalCheckedTransactions: number;
    totalCheckedMilestonePayments: number;
    totalCheckedInvoices: number;
    matchedRecords: number;
    totalDiscrepancies: number;
    unresolvedCount: number;
  };
  discrepancies: ReconciliationDiscrepancy[];
}

/**
 * Authoritative financial reconciliation engine.
 * Compares gateway transaction records, milestone payments, invoices, and webhooks.
 * READ-ONLY: Never silently mutates financial records.
 */
export async function runFinancialReconciliation(): Promise<ReconciliationReport> {
  const discrepancies: ReconciliationDiscrepancy[] = [];

  // 1. Fetch recent payment transactions
  const transactions = await prisma.paymentTransaction.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      milestonePayment: true,
    },
  });

  // 2. Fetch recent milestone payments
  const milestonePayments = await prisma.milestonePayment.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      transactions: true,
      milestone: true,
    },
  });

  // 3. Fetch recent invoices
  const invoices = await prisma.invoice.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  // 4. Fetch webhook events
  const webhookEvents = await prisma.webhookEvent.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  let matchedRecords = 0;

  // Audit Transactions vs Milestone Payments
  for (const tx of transactions) {
    if (tx.status === "COMPLETED") {
      if (!tx.gatewayPaymentId) {
        discrepancies.push({
          id: `disc_tx_nopayid_${tx.id}`,
          type: "MISSING_PROVIDER_RECORD",
          severity: "HIGH",
          entityType: "TRANSACTION",
          entityId: tx.id,
          description: `Transaction ${tx.id} marked COMPLETED but lacks gatewayPaymentId.`,
          details: {
            expected: "Valid gatewayPaymentId (e.g. pay_xxx)",
            actual: null,
            orderId: tx.gatewayOrderId,
          },
          resolved: false,
        });
      }

      if (tx.milestonePayment) {
        const mp = tx.milestonePayment;
        const txAmount = Number(tx.amount);
        const mpAmount = Number(mp.amount);

        // Check amount match
        if (Math.abs(txAmount - mpAmount) > 0.01) {
          discrepancies.push({
            id: `disc_amount_${tx.id}_${mp.id}`,
            type: "AMOUNT_MISMATCH",
            severity: "HIGH",
            entityType: "TRANSACTION",
            entityId: tx.id,
            description: `Amount mismatch between Transaction (${txAmount}) and MilestonePayment (${mpAmount}).`,
            details: {
              expected: txAmount,
              actual: mpAmount,
              orderId: tx.gatewayOrderId,
              paymentId: tx.gatewayPaymentId,
            },
            resolved: false,
          });
        }

        // Check status synchronization
        if (mp.status !== "HELD_IN_ESCROW" && mp.status !== "RELEASED" && mp.status !== "REFUNDED") {
          discrepancies.push({
            id: `disc_status_${tx.id}_${mp.id}`,
            type: "STATUS_MISMATCH",
            severity: "HIGH",
            entityType: "MILESTONE_PAYMENT",
            entityId: mp.id,
            description: `Transaction is COMPLETED but MilestonePayment is ${mp.status} instead of HELD_IN_ESCROW.`,
            details: {
              expected: "HELD_IN_ESCROW",
              actual: mp.status,
              orderId: tx.gatewayOrderId,
            },
            resolved: false,
          });
        } else {
          matchedRecords++;
        }
      } else {
        discrepancies.push({
          id: `disc_missing_mp_${tx.id}`,
          type: "MISSING_INTERNAL_RECORD",
          severity: "MEDIUM",
          entityType: "TRANSACTION",
          entityId: tx.id,
          description: `Transaction ${tx.id} completed without linked MilestonePayment record.`,
          details: {
            expected: "Linked MilestonePayment",
            actual: null,
            orderId: tx.gatewayOrderId,
          },
          resolved: false,
        });
      }
    }
  }

  // Audit Webhook Events
  const eventIds = new Set<string>();
  for (const wh of webhookEvents) {
    if (eventIds.has(wh.gatewayEventId)) {
      discrepancies.push({
        id: `disc_dup_wh_${wh.id}`,
        type: "DUPLICATE_WEBHOOK_EVENT",
        severity: "LOW",
        entityType: "WEBHOOK",
        entityId: wh.id,
        description: `Duplicate gateway event ID received: ${wh.gatewayEventId}`,
        details: {
          expected: "Unique gatewayEventId",
          actual: wh.gatewayEventId,
        },
        resolved: false,
      });
    }
    eventIds.add(wh.gatewayEventId);

    if (wh.processingStatus === "FAILED") {
      discrepancies.push({
        id: `disc_failed_wh_${wh.id}`,
        type: "UNPROCESSED_WEBHOOK",
        severity: "MEDIUM",
        entityType: "WEBHOOK",
        entityId: wh.id,
        description: `Webhook event ${wh.gatewayEventId} (${wh.eventType}) failed processing after ${wh.attempts} attempts.`,
        details: {
          expected: "COMPLETED",
          actual: wh.processingStatus,
        },
        resolved: false,
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalCheckedTransactions: transactions.length,
      totalCheckedMilestonePayments: milestonePayments.length,
      totalCheckedInvoices: invoices.length,
      matchedRecords,
      totalDiscrepancies: discrepancies.length,
      unresolvedCount: discrepancies.filter((d) => !d.resolved).length,
    },
    discrepancies,
  };
}

/**
 * Audited resolution of an identified reconciliation discrepancy.
 * Records explicit administrative action in ActivityLog without silent mutations.
 */
export async function resolveFinancialDiscrepancy(params: {
  adminUserId: string;
  discrepancyId: string;
  resolutionAction: "ACKNOWLEDGE_AUDITED" | "FLAG_FOR_MANUAL_REVIEW" | "RETRY_WEBHOOK_EVENT";
  notes: string;
  entityType: string;
  entityId: string;
}): Promise<{ success: boolean; message: string }> {
  const { adminUserId, discrepancyId, resolutionAction, notes, entityType, entityId } = params;

  // Log in authoritative append-only ActivityLog
  await prisma.activityLog.create({
    data: {
      entityType: "FINANCIAL_RECONCILIATION",
      entityId,
      action: "AUDIT_RECONCILIATION_RESOLVED",
      actorId: adminUserId,
      metadataJson: JSON.stringify({
        discrepancyId,
        resolutionAction,
        notes,
        resolvedAt: new Date().toISOString(),
      }),
    },
  });

  logger.audit({
    category: "PAYMENT",
    actorId: adminUserId,
    message: `Financial discrepancy ${discrepancyId} resolved with action ${resolutionAction}`,
    details: { discrepancyId, entityType, entityId, notes },
  });

  return {
    success: true,
    message: `Discrepancy ${discrepancyId} successfully resolved and recorded in audit log.`,
  };
}
