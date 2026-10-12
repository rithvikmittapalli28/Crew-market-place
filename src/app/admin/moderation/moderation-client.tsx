"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Filter,
  AlertTriangle,
  Ban,
  Loader2,
  X,
} from "lucide-react";

interface ReportItem {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  category: string;
  reason: string;
  status: string;
  actionTaken: string | null;
  adminNotes: string | null;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string };
  reviewedBy?: { id: string; name: string | null; email: string } | null;
}

export function AdminModerationClient() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);

  // Action modal
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [newStatus, setNewStatus] = useState("ACTION_TAKEN_WARNING");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      const res = await fetch(`/api/admin/moderation?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading reports");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.append("status", statusFilter);
        const res = await fetch(`/api/admin/moderation?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load reports");
        const data = await res.json();
        if (active) {
          setReports(data.reports || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error loading reports");
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const handleReview = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/moderation/${selectedReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actionTaken: newStatus.startsWith("ACTION_TAKEN_") ? newStatus.replace("ACTION_TAKEN_", "") : undefined,
          adminNotes: adminNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update report");
      setSelectedReport(null);
      setAdminNotes("");
      await fetchReports();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Review action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Filter by Status:</span>
          <select
            id="admin-moderation-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-input rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Reports</option>
            <option value="PENDING">PENDING</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="ACTION_TAKEN_SUSPENDED">ACTION TAKEN (SUSPENDED)</option>
            <option value="ACTION_TAKEN_WARNING">ACTION TAKEN (WARNING)</option>
            <option value="RESOLVED_NO_ACTION">RESOLVED (NO ACTION)</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
        </div>

        <span className="text-xs text-muted-foreground">
          {reports.length} Reports Queue
        </span>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Target Entity</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Reason / Claim</th>
                <th className="py-3.5 px-4">Reporter</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading moderation queue...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No reports matching filter.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors" id={`report-row-${r.id}`}>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground font-mono">{r.targetType}</span>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">ID: {r.targetId}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {r.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground max-w-xs truncate">
                      {r.reason}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {r.reporter.name || r.reporter.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === "PENDING"
                          ? "bg-destructive/15 text-destructive border border-destructive/20 animate-pulse"
                          : r.status.startsWith("ACTION_TAKEN")
                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        id={`review-report-btn-${r.id}`}
                        onClick={() => {
                          setSelectedReport(r);
                          setNewStatus(r.status === "PENDING" ? "ACTION_TAKEN_WARNING" : r.status);
                        }}
                        className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 font-bold text-base text-foreground">
                <ShieldAlert className="w-5 h-5 text-primary" />
                Moderation Decision
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1">
              <p className="font-semibold text-foreground">Target: {selectedReport.targetType} ({selectedReport.targetId})</p>
              <p className="text-muted-foreground">{selectedReport.reason}</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">New Report Status</label>
                <select
                  id="moderation-new-status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="ACTION_TAKEN_WARNING">ACTION TAKEN (WARNING)</option>
                  <option value="ACTION_TAKEN_SUSPENDED">ACTION TAKEN (SUSPEND USER)</option>
                  <option value="ACTION_TAKEN_CONTENT_REMOVED">ACTION TAKEN (REMOVE CONTENT)</option>
                  <option value="RESOLVED_NO_ACTION">RESOLVED (NO ACTION REQUIRED)</option>
                  <option value="DISMISSED">DISMISS REPORT</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                </select>
              </div>

              {newStatus === "ACTION_TAKEN_SUSPENDED" && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>Executing this decision will immediately suspend the target user account and revoke all active sessions.</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1">Administrative Notes</label>
                <textarea
                  id="moderation-notes-input"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record policy finding or rationale..."
                  className="w-full p-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-moderation-decision-btn"
                disabled={actionLoading}
                onClick={handleReview}
                className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow disabled:opacity-50"
              >
                {actionLoading ? "Applying..." : "Apply Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
