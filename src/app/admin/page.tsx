import React from "react";
import Link from "next/link";
import { getAdminDashboardMetrics } from "@/lib/admin/service";
import {
  Users,
  Building2,
  Palette,
  Briefcase,
  Scale,
  ShieldAlert,
  TrendingUp,
  ArrowUpRight,
  Shield,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardMetrics();

  const formatINR = (val: number) =>
    `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Platform Command Center
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Authoritative platform analytics, escrow metrics, user safety, and dispute triage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/disputes"
            id="admin-quick-disputes"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all"
          >
            <Scale className="w-3.5 h-3.5" />
            Disputes ({metrics.counts.openDisputes})
          </Link>
          <Link
            href="/admin/moderation"
            id="admin-quick-moderation"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 rounded-xl hover:bg-destructive/20 transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Reports ({metrics.counts.pendingModerationReports})
          </Link>
        </div>
      </div>

      {/* Core Entity Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Registered Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground" id="metric-total-users">
            {metrics.counts.totalUsers.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">Across all platform roles</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Businesses</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground" id="metric-active-businesses">
            {metrics.counts.activeBusinesses.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">Verified brand entities</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Creators & Freelancers</span>
            <Palette className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground" id="metric-active-creators">
            {metrics.counts.activeFreelancers.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">Onboarded creator profiles</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Projects</span>
            <Briefcase className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-foreground" id="metric-active-projects">
            {metrics.counts.activeProjects.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">In-progress collaborations</p>
        </div>
      </div>

      {/* Financial Operations Summary */}
      <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Authoritative Financial Operations</h2>
          </div>
          <Link
            href="/admin/payments"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View Payment Transactions <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Gross Transaction Volume</span>
            <div className="text-xl font-bold text-foreground" id="metric-gross-volume">
              {formatINR(metrics.financial.grossTransactionVolumeINR)}
            </div>
            <p className="text-[10px] text-muted-foreground">Captured Razorpay gateway volume</p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Platform Revenue (Fees)</span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400" id="metric-platform-fees">
              {formatINR(metrics.financial.platformFeesEarnedINR)}
            </div>
            <p className="text-[10px] text-muted-foreground">Earned marketplace service fees</p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Paid Tax Invoices</span>
            <div className="text-xl font-bold text-foreground" id="metric-paid-invoices">
              {metrics.financial.paidInvoicesCount} ({formatINR(metrics.financial.paidInvoicesVolumeINR)})
            </div>
            <p className="text-[10px] text-muted-foreground">Settled GST invoice receipts</p>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Executed Contracts</span>
            <div className="text-xl font-bold text-foreground" id="metric-executed-contracts">
              {metrics.counts.executedContracts}
            </div>
            <p className="text-[10px] text-muted-foreground">Legally signed snapshots</p>
          </div>
        </div>
      </div>

      {/* Grid: Recent Disputes & Recent Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Disputes */}
        <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Recent Disputes Triage</h3>
            </div>
            <Link
              href="/admin/disputes"
              className="text-xs text-primary hover:underline"
            >
              All Disputes →
            </Link>
          </div>

          {metrics.recentDisputes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No active or historical disputes recorded.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {metrics.recentDisputes.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {d.projectTitle}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Initiated by {d.initiatorName || "Participant"} • {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit Log */}
        <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Platform Audit Log</h3>
            </div>
            <Link
              href="/admin/audit-log"
              className="text-xs text-primary hover:underline"
            >
              Full Log →
            </Link>
          </div>

          {metrics.recentActivities.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No audit records found.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {metrics.recentActivities.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate font-mono">
                      {log.action}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {log.entityType} #{log.entityId.slice(0, 8)} • by {log.actorName || log.actorEmail || "System"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
