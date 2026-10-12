"use client";

import React, { useState, useCallback } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  Download,
} from "lucide-react";
import { ContractCreateModal } from "@/components/contracts/contract-create-modal";
import { ContractDetailView } from "@/components/contracts/contract-detail-view";
import type { ContractDetailData } from "@/components/contracts/contract-detail-view";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractListItem {
  id: string;
  title: string;
  status: "DRAFT" | "SENT" | "EXECUTED" | "DECLINED" | "TERMINATED";
  totalAmount: number;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  executedAt?: string | null;
  declineReason?: string | null;
  createdAt: string;
  hasSignedSnapshot?: boolean;
  parties: Array<{
    id: string;
    userId: string;
    role: string;
    signedAt?: string | null;
    hasSignature?: boolean;
    user: { id: string; name: string | null; email: string | null; avatarUrl?: string | null };
  }>;
  business?: { id: string; name: string; logoUrl?: string | null } | null;
}

interface ContractsTabProps {
  projectId: string;
  currentUserId: string;
  isBusinessMember: boolean;
  defaultFreelancerId?: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: {
    label: "Draft",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-secondary text-muted-foreground",
  },
  SENT: {
    label: "Awaiting Signatures",
    icon: <Send className="h-3.5 w-3.5" />,
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  EXECUTED: {
    label: "Executed",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    className: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  DECLINED: {
    label: "Declined",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-destructive/15 text-destructive",
  },
  TERMINATED: {
    label: "Terminated",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: "bg-muted text-muted-foreground",
  },
} as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContractsTab({
  projectId,
  currentUserId,
  isBusinessMember,
  defaultFreelancerId,
}: ContractsTabProps) {
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ContractDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Fetch contract list ────────────────────────────────────────────────────
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/contracts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contracts");
      setContracts(data.contracts || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ── Fetch single contract detail ───────────────────────────────────────────
  const fetchContractDetail = useCallback(async (contractId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contract");
      setDetailData(data.contract);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Failed to load contract");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = useCallback(
    (contractId: string) => {
      setSelectedContractId(contractId);
      void fetchContractDetail(contractId);
    },
    [fetchContractDetail]
  );

  const closeDetail = useCallback(() => {
    setSelectedContractId(null);
    setDetailData(null);
    setDetailError(null);
  }, []);

  const handleRefresh = useCallback(() => {
    void fetchContracts();
    if (selectedContractId) {
      void fetchContractDetail(selectedContractId);
    }
  }, [fetchContracts, fetchContractDetail, selectedContractId]);

  // Load contracts on mount or when projectId changes
  React.useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/contracts`);
        const data = await res.json();
        if (!isMounted) return;
        if (!res.ok) throw new Error(data.error || "Failed to load contracts");
        setContracts(data.contracts || []);
      } catch (err: unknown) {
        if (isMounted) setError(err instanceof Error ? err.message : "Failed to load contracts");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // ── Detail pane ────────────────────────────────────────────────────────────
  if (selectedContractId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={closeDetail}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          id="back-to-contracts-btn"
        >
          ← Back to Contracts
        </button>

        {detailLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading contract…
          </div>
        )}

        {detailError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
            {detailError}
          </div>
        )}

        {detailData && (
          <ContractDetailView
            contract={detailData}
            currentUserId={currentUserId}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    );
  }

  // ── List pane ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Contracts ({contracts.length})
          </h3>
          <button
            type="button"
            id="refresh-contracts-btn"
            onClick={() => void fetchContracts()}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isBusinessMember && (
          <button
            type="button"
            id="create-contract-btn"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Draft Contract
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && contracts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-12 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No contracts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isBusinessMember
                ? "Draft a formal contract with digital signatures and escrow-backed terms."
                : "No contracts have been issued for this project yet."}
            </p>
          </div>
          {isBusinessMember && (
            <button
              type="button"
              id="create-first-contract-btn"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Draft First Contract
            </button>
          )}
        </div>
      )}

      {/* Contract list */}
      {contracts.length > 0 && (
        <div className="space-y-3">
          {contracts.map((contract) => {
            const cfg = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.DRAFT;
            const myParty = contract.parties.find((p) => p.userId === currentUserId);
            const signedCount = contract.parties.filter((p) => p.signedAt).length;
            const totalParties = contract.parties.length;
            const needsMySignature =
              myParty && !myParty.signedAt && contract.status === "SENT";

            return (
              <div
                key={contract.id}
                className="group rounded-xl border border-border bg-card p-4 hover:border-foreground/20 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Title + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        id={`view-contract-${contract.id}`}
                        onClick={() => openDetail(contract.id)}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-left truncate"
                      >
                        {contract.title}
                      </button>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cfg.className}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      {needsMySignature && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary shrink-0 animate-pulse">
                          ✍️ Your signature required
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>
                        ₹{Number(contract.totalAmount).toLocaleString("en-IN")}
                      </span>
                      {contract.effectiveDate && (
                        <span>
                          Effective{" "}
                          {new Date(contract.effectiveDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {contract.executedAt && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ✓ Executed{" "}
                          {new Date(contract.executedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      <span>
                        {new Date(contract.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Signature progress */}
                    {contract.status === "SENT" || contract.status === "EXECUTED" ? (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center gap-1">
                          {contract.parties.map((p) => (
                            <div
                              key={p.id}
                              title={`${p.user.name || p.user.email} (${p.role.replace("_", " ")})`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                p.signedAt
                                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {p.signedAt ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              <span className="truncate max-w-[100px]">
                                {p.user.name?.split(" ")[0] || p.user.email?.split("@")[0]}
                              </span>
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {signedCount}/{totalParties} signed
                        </span>
                      </div>
                    ) : null}

                    {contract.declineReason && (
                      <p className="text-[11px] text-destructive italic mt-1">
                        Declined: {contract.declineReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {contract.hasSignedSnapshot && (
                      <a
                        href={`/api/invoices`}
                        title="Download contract snapshot"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      id={`open-contract-detail-${contract.id}`}
                      onClick={() => openDetail(contract.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg transition-all"
                    >
                      View
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <ContractCreateModal
        projectId={projectId}
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          void fetchContracts();
        }}
        defaultFreelancerId={defaultFreelancerId}
      />
    </div>
  );
}
