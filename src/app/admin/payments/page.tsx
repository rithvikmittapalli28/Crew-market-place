import React from "react";
import { prisma } from "@/lib/prisma";
import { CreditCard } from "lucide-react";

export default async function AdminPaymentsPage() {
  const [payments, milestonePayments] = await Promise.all([
    prisma.paymentTransaction.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        platformFees: true,
      },
    }),
    prisma.milestonePayment.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        milestone: {
          select: { id: true, title: true, project: { select: { title: true } } },
        },
      },
    }),
    prisma.refund.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
    prisma.payout.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        recipient: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Ledger & Escrow Oversight</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Inspect gateway payment transactions, escrow fund locking states, refunds, and creator payouts.
        </p>
      </div>

      {/* Gateway Transactions */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-3">
        <div className="p-4 border-b border-border bg-muted/20 font-semibold text-xs text-foreground flex items-center justify-between">
          <span>Razorpay Gateway Transactions ({payments.length})</span>
          <span className="text-muted-foreground text-[11px]">Authoritative payment gateway records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Payer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Platform Fee</th>
                <th className="py-3 px-4">Gateway Reference</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No payment transactions recorded.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors" id={`payment-row-${p.id}`}>
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {p.id.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <p className="text-foreground font-medium">{p.payer?.name || "Anonymous Payer"}</p>
                      <p className="text-[10px] text-muted-foreground">{p.payer?.email}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      ₹{Number(p.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400">
                      {p.platformFees[0] ? `₹${Number(p.platformFees[0].amount).toLocaleString("en-IN")}` : "₹0"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                      {p.gatewayPaymentId || p.gatewayOrderId || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        p.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : p.status === "FAILED"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-amber-500/15 text-amber-600"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escrow Milestone Balances */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-3">
        <div className="p-4 border-b border-border bg-muted/20 font-semibold text-xs text-foreground flex items-center justify-between">
          <span>Escrow Milestone Balances ({milestonePayments.length})</span>
          <span className="text-muted-foreground text-[11px]">Server-authoritative escrow ledger</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Milestone</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Escrow Amount</th>
                <th className="py-3 px-4">Held At</th>
                <th className="py-3 px-4 text-right">Escrow Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {milestonePayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No escrow records found.
                  </td>
                </tr>
              ) : (
                milestonePayments.map((mp) => (
                  <tr key={mp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {mp.milestone.title}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {mp.milestone.project.title}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      ₹{Number(mp.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-muted-foreground">
                      {mp.escrowHeldAt ? new Date(mp.escrowHeldAt).toLocaleDateString() : "Pending"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        mp.status === "HELD_IN_ESCROW"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : mp.status === "RELEASED"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {mp.status}
                      </span>
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
