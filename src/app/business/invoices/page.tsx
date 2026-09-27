import { requireBusinessMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { BusinessInvoicesClient, type InvoiceItem } from "./invoices-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoices & Billing Receipts — Crewn",
  description: "View and download tax invoices and milestone escrow payment receipts.",
};

export default async function BusinessInvoicesPage() {
  const user = await requireBusinessMember();

  const businessIds = (user.businessMemberships ?? []).map((m) => m.businessId);

  const invoices = await prisma.invoice.findMany({
    where: { businessId: { in: businessIds } },
    orderBy: { createdAt: "desc" },
    include: {
      business: { select: { id: true, name: true } },
      recipient: { select: { id: true, name: true, email: true } },
    },
  });

  const formattedInvoices: InvoiceItem[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    totalAmount: Number(inv.totalAmount),
    taxAmount: Number(inv.taxAmount),
    currency: inv.currency,
    status: inv.status,
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    businessName: inv.business.name,
    recipientName: inv.recipient.name || inv.recipient.email,
    recipientEmail: inv.recipient.email,
    items: inv.itemsJson ? JSON.parse(inv.itemsJson) : [],
  }));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Invoices & Billing Receipts"
        subtitle="Manage official GST tax invoices and milestone payment receipts."
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <BusinessInvoicesClient invoices={formattedInvoices} />
      </main>
    </div>
  );
}
