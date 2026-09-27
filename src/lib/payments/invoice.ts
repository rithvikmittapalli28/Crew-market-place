import { prisma } from "@/lib/prisma";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Generates a sequential, professional invoice number: INV-YYYYMM-XXXX
 */
export async function generateInvoiceNumber(): Promise<string> {
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${yearMonth}-`;

  const count = await prisma.invoice.count({
    where: {
      invoiceNumber: { startsWith: prefix },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}${sequence}`;
}

/**
 * Formats structured line items for milestone billing.
 */
export function buildMilestoneInvoiceItems(params: {
  milestoneTitle: string;
  projectTitle: string;
  amount: number;
  platformFeeAmount?: number;
}): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [
    {
      description: `Project: ${params.projectTitle} — Milestone: ${params.milestoneTitle}`,
      quantity: 1,
      unitPrice: params.amount,
      total: params.amount,
    },
  ];

  if (params.platformFeeAmount && params.platformFeeAmount > 0) {
    items.push({
      description: "Platform Processing & Escrow Service Fee",
      quantity: 1,
      unitPrice: params.platformFeeAmount,
      total: params.platformFeeAmount,
    });
  }

  return items;
}
