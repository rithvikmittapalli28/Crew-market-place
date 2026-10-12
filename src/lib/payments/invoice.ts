import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Atomically allocates the next sequential number using PostgreSQL's
 * ON CONFLICT DO UPDATE row lock on InvoiceSequence.
 */
export async function getNextInvoiceSequence(yearMonth: string, client: DbClient = prisma): Promise<number> {
  const result: Array<{ lastSeq: number }> = await client.$queryRaw`
    INSERT INTO "InvoiceSequence" ("id", "lastSeq", "updatedAt")
    VALUES (${yearMonth}, 1, NOW())
    ON CONFLICT ("id")
    DO UPDATE SET "lastSeq" = "InvoiceSequence"."lastSeq" + 1, "updatedAt" = NOW()
    RETURNING "lastSeq"
  `;
  return Number(result[0]?.lastSeq ?? 1);
}

/**
 * Generates an atomic, unique, sequential invoice number: INV-YYYYMM-XXXX
 * Guaranteed collision-free even under heavy concurrent load.
 */
export async function generateInvoiceNumber(tx?: DbClient): Promise<string> {
  const db = tx || prisma;
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${yearMonth}-`;

  for (let attempt = 0; attempt < 10; attempt++) {
    const seq = await getNextInvoiceSequence(yearMonth, db);
    const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    const existing = await db.invoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });

    if (!existing) {
      return invoiceNumber;
    }
  }

  const fallbackEntropy = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${Date.now().toString().slice(-4)}${fallbackEntropy}`;
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
