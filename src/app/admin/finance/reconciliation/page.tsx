import React from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import { runFinancialReconciliation } from "@/lib/payments/reconciliation";
import { ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function AdminReconciliationPage() {
  await requireAdminUser("/login");
  const report = await runFinancialReconciliation();

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Financial Reconciliation & Audit Console
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Authoritative comparison between Razorpay payment gateway transactions, internal escrow ledgers, invoices, and webhooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/finance/reconciliation"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-card hover:bg-muted transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            Re-run Audit
          </Link>
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Payment Ledger
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Audited Records
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {report.summary.totalCheckedTransactions + report.summary.totalCheckedMilestonePayments}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {report.summary.totalCheckedTransactions} TXs · {report.summary.totalCheckedInvoices} Invoices
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Fully Reconciled
          </div>
          <div className="text-2xl font-bold text-emerald-500 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {report.summary.matchedRecords}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            100% matched gateway & escrow
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Discrepancies
          </div>
          <div className={`text-2xl font-bold mt-1 ${report.summary.totalDiscrepancies > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            {report.summary.totalDiscrepancies}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Status, amount, or webhook gaps
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Unresolved
          </div>
          <div className={`text-2xl font-bold mt-1 ${report.summary.unresolvedCount > 0 ? "text-rose-500" : "text-emerald-500"}`}>
            {report.summary.unresolvedCount}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            Requires manual administrative audit
          </div>
        </div>
      </div>

      {/* Discrepancy Matrix */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-xs text-foreground">
              Reconciliation Discrepancy Queue ({report.discrepancies.length})
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Non-destructive audit review only
          </span>
        </div>

        {report.discrepancies.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-foreground">All Authoritative Records Synchronized</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Zero status mismatches, amount discrepancies, or missing gateway records detected across recent transactions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/10 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Discrepancy Type</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.discrepancies.map((disc) => (
                  <tr key={disc.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          disc.severity === "HIGH"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : disc.severity === "MEDIUM"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {disc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      {disc.type}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">
                        {disc.entityType}:{disc.entityId.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground max-w-xs truncate">
                      {disc.description}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                      Exp: {JSON.stringify(disc.details.expected)} | Act: {JSON.stringify(disc.details.actual)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Pending Review
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Safety Policy Notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Financial Ledger Mutation Guard</p>
          <p className="text-muted-foreground leading-relaxed">
            Reconciliation runs in read-only inspection mode. It will never automatically modify transactions, escrow ledgers, or invoice balances. All resolutions must be executed through audited administrative decisions with explicit explanations recorded in the platform ActivityLog.
          </p>
        </div>
      </div>
    </div>
  );
}
