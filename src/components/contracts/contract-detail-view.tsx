"use client";

import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  PenTool,
  ShieldCheck,
  Calendar,
  DollarSign,
  AlertCircle,
  UserCheck,
  Download,
} from "lucide-react";
import { SignatureCanvas } from "./signature-canvas";

export interface ContractPartyInfo {
  id: string;
  userId: string;
  role: string;
  signedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  signatureDataUrl?: string | null;
  hasSignature?: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl?: string | null;
  };
}

export interface ContractDetailData {
  id: string;
  projectId: string;
  businessId: string;
  title: string;
  termsText: string;
  scopeOfWork?: string | null;
  deliverablesText?: string | null;
  milestonesJson?: string | null;
  paymentTerms?: string | null;
  revisionTerms?: string | null;
  cancellationTerms?: string | null;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  totalAmount: number;
  status: "DRAFT" | "SENT" | "EXECUTED" | "DECLINED" | "TERMINATED";
  declineReason?: string | null;
  executedAt?: string | null;
  signedSnapshot?: Record<string, unknown> | null;
  createdAt: string;
  parties: ContractPartyInfo[];
  business?: { id: string; name: string; logoUrl?: string | null } | null;
}

interface ContractDetailViewProps {
  contract: ContractDetailData;
  currentUserId: string;
  onRefresh?: () => void;
}

export function ContractDetailView({
  contract,
  currentUserId,
  onRefresh,
}: ContractDetailViewProps) {
  const [showSignModal, setShowSignModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentUserParty = contract.parties.find((p) => p.userId === currentUserId);
  const isParty = !!currentUserParty;
  const hasUserSigned = !!currentUserParty?.signedAt;
  const isClientSigner = currentUserParty?.role === "CLIENT_SIGNER";

  const handleSendForSignature = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send contract");
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error sending contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSign = async (dataUrl: string) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign contract");
      setShowSignModal(false);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error signing contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      setActionError("Please provide a reason for declining");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", reason: declineReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decline contract");
      setShowDeclineModal(false);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error declining contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadSnapshot = () => {
    if (!contract.signedSnapshot) return;
    const blob = new Blob([JSON.stringify(contract.signedSnapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Signed-Contract-${contract.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">{contract.title}</h2>
            {contract.status === "EXECUTED" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Fully Executed
              </span>
            )}
            {contract.status === "SENT" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5" />
                Awaiting Signatures
              </span>
            )}
            {contract.status === "DRAFT" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                Draft
              </span>
            )}
            {contract.status === "DECLINED" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                <XCircle className="w-3.5 h-3.5" />
                Declined
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Contract ID: <span className="font-mono">{contract.id}</span> • Created on{" "}
            {new Date(contract.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {contract.status === "DRAFT" && isClientSigner && (
            <button
              type="button"
              id="send-contract-btn"
              onClick={handleSendForSignature}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Send for Signature
            </button>
          )}

          {contract.status === "SENT" && isParty && !hasUserSigned && (
            <>
              <button
                type="button"
                id="sign-contract-btn"
                onClick={() => setShowSignModal(true)}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-all shadow-sm"
              >
                <PenTool className="w-3.5 h-3.5" />
                Review & Sign
              </button>
              <button
                type="button"
                id="decline-contract-btn"
                onClick={() => setShowDeclineModal(true)}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 rounded-xl transition-all"
              >
                <XCircle className="w-3.5 h-3.5" />
                Decline
              </button>
            </>
          )}

          {contract.status === "EXECUTED" && contract.signedSnapshot && (
            <button
              type="button"
              id="download-snapshot-btn"
              onClick={downloadSnapshot}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download Snapshot
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {contract.status === "DECLINED" && contract.declineReason && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-xs space-y-1">
          <p className="font-semibold text-destructive">Contract Declined Reason:</p>
          <p className="text-foreground">{contract.declineReason}</p>
        </div>
      )}

      {/* Contract Terms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <DollarSign className="w-4 h-4 text-primary" />
            Financial & Payment Terms
          </div>
          <div className="text-2xl font-bold text-foreground">
            ₹{contract.totalAmount.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap">
            {contract.paymentTerms || "Full payment upon approved milestone deliverables."}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-primary" />
            Key Dates & Expiry
          </div>
          <div className="text-xs space-y-1 text-foreground/80">
            <div>
              <span className="text-muted-foreground">Effective Date: </span>
              {contract.effectiveDate
                ? new Date(contract.effectiveDate).toLocaleDateString()
                : "Upon full execution"}
            </div>
            {contract.expiresAt && (
              <div>
                <span className="text-muted-foreground">Expires At: </span>
                {new Date(contract.expiresAt).toLocaleDateString()}
              </div>
            )}
            {contract.executedAt && (
              <div>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Executed At:{" "}
                </span>
                {new Date(contract.executedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scope of Work & Deliverables */}
      {(contract.scopeOfWork || contract.deliverablesText) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contract.scopeOfWork && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scope of Work
              </h4>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {contract.scopeOfWork}
              </p>
            </div>
          )}
          {contract.deliverablesText && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deliverables
              </h4>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {contract.deliverablesText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Revision & Cancellation Terms */}
      {(contract.revisionTerms || contract.cancellationTerms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contract.revisionTerms && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Revision Policy
              </h4>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {contract.revisionTerms}
              </p>
            </div>
          )}
          {contract.cancellationTerms && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cancellation & Termination
              </h4>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {contract.cancellationTerms}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Full Legal Terms Text */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="w-4 h-4 text-primary" />
          Master Terms & Conditions
        </div>
        <div className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto pr-2 bg-muted/10 p-3 rounded-lg border border-border/40">
          {contract.termsText}
        </div>
      </div>

      {/* Parties & Digital Signatures Audit Trail */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          Designated Signers & Cryptographic Audit Trail
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contract.parties.map((party) => {
            const isSigned = !!party.signedAt;
            return (
              <div
                key={party.id}
                className={`p-4 rounded-xl border transition-all ${
                  isSigned
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-muted/30 border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {party.role === "CLIENT_SIGNER" ? "Client / Business" : "Freelancer / Creator"}
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {party.user.name || party.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{party.user.email}</p>
                  </div>
                  {isSigned ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Signed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="w-4 h-4" />
                      Pending
                    </span>
                  )}
                </div>

                {isSigned && party.signatureDataUrl && (
                  <div className="mt-3 border border-border/60 rounded-lg p-2 bg-white max-w-[220px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={party.signatureDataUrl}
                      alt={`${party.user.name || "Party"} signature`}
                      className="h-14 object-contain"
                    />
                  </div>
                )}

                {isSigned && (
                  <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-muted-foreground space-y-0.5">
                    <div>
                      <span className="font-medium text-foreground">Signed at: </span>
                      {new Date(party.signedAt!).toLocaleString()}
                    </div>
                    {party.ipAddress && (
                      <div>
                        <span className="font-medium text-foreground">IP Address: </span>
                        {party.ipAddress}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <SignatureCanvas
            signerName={currentUserParty?.user.name || ""}
            onSign={handleSign}
            onCancel={() => setShowSignModal(false)}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">Decline Contract</h3>
            <p className="text-xs text-muted-foreground">
              Please specify the reason for declining this contract. This will be visible to all
              parties.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Terms require revision on milestone delivery timeline..."
              rows={4}
              className="w-full p-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl disabled:opacity-50"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
