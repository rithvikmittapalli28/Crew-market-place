import React from "react";
import { prisma } from "@/lib/prisma";
import { Receipt, Download } from "lucide-react";

export default async function AdminInvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      business: { select: { id: true, name: true } },
      recipient: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tax Invoices & Receipts Ledger</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Inspect authoritative GST tax invoices, audit sequential invoice series, and verify binary PDF generation.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Invoice Number</th>
                <th className="py-3.5 px-4">Business Issuer</th>
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Total Amount (INR)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">PDF Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No tax invoices recorded.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors" id={`invoice-row-${inv.id}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-foreground">{inv.business.name}</p>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      <p className="text-foreground font-medium">{inv.recipient.name || "Recipient"}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.recipient.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      ₹{Number(inv.totalAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        inv.status === "PAID"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors text-foreground"
                      >
                        <Download className="w-3 h-3" />
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
