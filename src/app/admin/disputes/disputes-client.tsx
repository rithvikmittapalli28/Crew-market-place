"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Scale,
  Filter,
  AlertCircle,
  CheckCircle2,
  Send,
  FileText,
  ShieldCheck,
  Loader2,
  X,
} from "lucide-react";

interface DisputeListItem {
  id: string;
  projectId: string;
  category: string | null;
  reason: string;
  status: string;
  createdAt: string;
  project: { id: string; title: string };
  milestone?: { id: string; title: string; amount: number } | null;
  initiator: { id: string; name: string | null; email: string };
  respondent: { id: string; name: string | null; email: string };
  _count: { messages: number };
}

interface DisputeDetailData {
  id: string;
  projectId: string;
  category: string | null;
  reason: string;
  status: string;
  resolution: string | null;
  adminNotes: string | null;
  resolutionAction: string | null;
  refundAmount: number | null;
  releaseAmount: number | null;
  resolvedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    businessId: string;
    business: { id: string; name: string };
  };
  milestone?: {
    id: string;
    title: string;
    amount: number;
    payments: Array<{ id: string; amount: number; status: string }>;
  } | null;
  contract?: {
    id: string;
    title: string;
    status: string;
    totalAmount: number;
  } | null;
  initiator: { id: string; name: string | null; email: string; role: string };
  respondent: { id: string; name: string | null; email: string; role: string };
  resolvedBy?: { id: string; name: string | null; email: string } | null;
  messages: Array<{
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; name: string | null; email: string; role: string };
    attachmentFile?: { id: string; fileName: string; fileSize: number } | null;
  }>;
}

export function AdminDisputesClient() {
  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);

  // Selected dispute for inspection / resolution
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisputeDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New admin message
  const [adminMessage, setAdminMessage] = useState("");
  const [msgSubmitting, setMsgSubmitting] = useState(false);

  // Resolution modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveAction, setResolveAction] = useState<"RELEASE_ESCROW" | "REFUND_BUYER" | "PARTIAL_SPLIT" | "CLOSE_NO_ACTION">("RELEASE_ESCROW");
  const [resolveText, setResolveText] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [customRefund, setCustomRefund] = useState<string>("");
  const [customRelease, setCustomRelease] = useState<string>("");
  const [resolveLoading, setResolveLoading] = useState(false);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      const res = await fetch(`/api/admin/disputes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load disputes");
      const data = await res.json();
      setDisputes(data.disputes || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading disputes");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/disputes/${id}`);
      if (!res.ok) throw new Error("Failed to load dispute details");
      const data = await res.json();
      setDetail(data.dispute);
      setSelectedDisputeId(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load dispute details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.append("status", statusFilter);
        const res = await fetch(`/api/admin/disputes?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load disputes");
        const data = await res.json();
        if (active) {
          setDisputes(data.disputes || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error loading disputes");
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeId || !adminMessage.trim()) return;
    setMsgSubmitting(true);
    try {
      const res = await fetch(`/api/admin/disputes/${selectedDisputeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: adminMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post message");
      setAdminMessage("");
      await loadDetail(selectedDisputeId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error posting message");
    } finally {
      setMsgSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedDisputeId || !resolveText.trim()) return;
    setResolveLoading(true);
    try {
      const res = await fetch(`/api/admin/disputes/${selectedDisputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionAction: resolveAction,
          resolutionText: resolveText.trim(),
          adminNotes: resolveNotes.trim() || undefined,
          refundAmount: customRefund ? parseFloat(customRefund) : undefined,
          releaseAmount: customRelease ? parseFloat(customRelease) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve dispute");
      setShowResolveModal(false);
      setResolveText("");
      setResolveNotes("");
      await loadDetail(selectedDisputeId);
      await fetchDisputes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Resolution failed");
    } finally {
      setResolveLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedDisputeId) return;
    try {
      const res = await fetch(`/api/admin/disputes/${selectedDisputeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      await loadDetail(selectedDisputeId);
      await fetchDisputes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Status update failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Filter by Status:</span>
          <select
            id="admin-dispute-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-input rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="UNDER_REVIEW">UNDER REVIEW</option>
            <option value="EVIDENCE_REQUESTED">EVIDENCE REQUESTED</option>
            <option value="ESCALATED">ESCALATED</option>
            <option value="RESOLVED_BUYER">RESOLVED BUYER</option>
            <option value="RESOLVED_CREATOR">RESOLVED CREATOR</option>
            <option value="PARTIAL_RESOLUTION">PARTIAL RESOLUTION</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <span className="text-xs text-muted-foreground">
          {disputes.length} Disputes Total
        </span>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Disputes List + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Disputes Table */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[700px]">
          <div className="p-4 border-b border-border font-semibold text-xs text-foreground bg-muted/20 flex items-center justify-between">
            <span>Disputes Queue</span>
            <span className="text-muted-foreground">{disputes.length} items</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Loading disputes...
              </div>
            ) : disputes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No disputes found.
              </div>
            ) : (
              disputes.map((d) => (
                <div
                  key={d.id}
                  id={`dispute-item-${d.id}`}
                  onClick={() => loadDetail(d.id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedDisputeId === d.id
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-xs text-foreground truncate">
                      {d.project.title}
                    </p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                      d.status.startsWith("RESOLVED") || d.status === "CLOSED"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : d.status === "OPEN"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                    }`}>
                      {d.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {d.reason}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span>{d.initiator.name || d.initiator.email} vs {d.respondent.name || d.respondent.email}</span>
                    <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Dispute Detail & Resolution View */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[700px]">
          {!selectedDisputeId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
              <Scale className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Select a dispute from the queue to inspect</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Inspect party claims, review contract snapshots, examine evidence, and execute financial resolutions.
              </p>
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="p-4 border-b border-border bg-muted/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{detail.project.title}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Dispute #{detail.id.slice(0, 8)} • Initiated {new Date(detail.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!detail.status.startsWith("RESOLVED") && detail.status !== "CLOSED" && (
                      <button
                        type="button"
                        id="open-resolve-dispute-modal-btn"
                        onClick={() => setShowResolveModal(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-sm flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Resolve Dispute
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Triage Dropdown */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground">Triage Status:</span>
                  <select
                    id="triage-dispute-status-select"
                    value={detail.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="bg-background border border-input rounded-lg px-2 py-1 text-[11px] text-foreground"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    <option value="EVIDENCE_REQUESTED">EVIDENCE REQUESTED</option>
                    <option value="ESCALATED">ESCALATED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              {/* Dispute Metadata & Resolution Banner if resolved */}
              {detail.resolution && (
                <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Resolved ({detail.resolutionAction || detail.status})
                  </div>
                  <p className="text-foreground">{detail.resolution}</p>
                  {detail.resolvedBy && (
                    <p className="text-[10px] text-muted-foreground">
                      Resolved by {detail.resolvedBy.name || detail.resolvedBy.email} on {new Date(detail.resolvedAt!).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Messages & Evidence Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
                <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Initiator Claim ({detail.initiator.name})</span>
                    <span>{new Date(detail.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-foreground">{detail.reason}</p>
                </div>

                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl text-xs space-y-1 ${
                      m.sender.role === "ADMIN"
                        ? "bg-purple-500/10 border border-purple-500/20 ml-4"
                        : "bg-card border border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        {m.sender.role === "ADMIN" && <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />}
                        {m.sender.name || m.sender.email} ({m.sender.role})
                      </span>
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{m.content}</p>
                    {m.attachmentFile && (
                      <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 text-[11px] text-primary">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Evidence: {m.attachmentFile.fileName}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Post Admin Message */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card flex gap-2">
                <input
                  type="text"
                  id="admin-dispute-msg-input"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Send admin instruction or request evidence..."
                  className="flex-1 px-3.5 py-2 bg-background border border-input rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  id="admin-dispute-send-msg-btn"
                  disabled={msgSubmitting || !adminMessage.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Dispute Resolution Modal */}
      {showResolveModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 font-bold text-base text-foreground">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Resolve Dispute & Settle Escrow
              </div>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Settlement Decision *
                </label>
                <select
                  id="dispute-resolution-action-select"
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value as "RELEASE_ESCROW" | "REFUND_BUYER" | "PARTIAL_SPLIT" | "CLOSE_NO_ACTION")}
                  className="w-full p-2.5 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="RELEASE_ESCROW">Release Escrow to Creator (Milestone Paid)</option>
                  <option value="REFUND_BUYER">Refund Escrow to Buyer (Milestone Refunded)</option>
                  <option value="PARTIAL_SPLIT">Partial Split (Split Escrow Balance)</option>
                  <option value="CLOSE_NO_ACTION">Close Dispute Without Balance Modification</option>
                </select>
              </div>

              {resolveAction === "PARTIAL_SPLIT" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      Refund to Buyer (₹)
                    </label>
                    <input
                      type="number"
                      id="dispute-custom-refund-input"
                      value={customRefund}
                      onChange={(e) => setCustomRefund(e.target.value)}
                      placeholder="e.g. 20000"
                      className="w-full p-2 rounded-lg border border-input bg-background text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      Release to Creator (₹)
                    </label>
                    <input
                      type="number"
                      id="dispute-custom-release-input"
                      value={customRelease}
                      onChange={(e) => setCustomRelease(e.target.value)}
                      placeholder="e.g. 25000"
                      className="w-full p-2 rounded-lg border border-input bg-background text-xs text-foreground"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Official Written Resolution (Visible to Both Parties) *
                </label>
                <textarea
                  id="dispute-resolution-text-input"
                  required
                  rows={3}
                  value={resolveText}
                  onChange={(e) => setResolveText(e.target.value)}
                  placeholder="Provide authoritative findings, policy justifications, and next steps..."
                  className="w-full p-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Private Admin Notes (Internal Audit Only)
                </label>
                <input
                  type="text"
                  id="dispute-admin-notes-input"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Optional internal investigator notes..."
                  className="w-full p-2.5 rounded-xl border border-input bg-background text-xs text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-resolve-dispute-btn"
                disabled={resolveLoading || !resolveText.trim()}
                onClick={handleResolve}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-all shadow disabled:opacity-50"
              >
                {resolveLoading ? "Executing Resolution..." : "Execute Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
