"use client";

import React, { useState } from "react";
import { FilePlus, X, AlertCircle } from "lucide-react";

interface ContractCreateModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultFreelancerId?: string;
}

export function ContractCreateModal({
  projectId,
  isOpen,
  onClose,
  onSuccess,
  defaultFreelancerId,
}: ContractCreateModalProps) {
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState<number | "">("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [deliverablesText, setDeliverablesText] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Payment released upon approved milestone deliverable.");
  const [revisionTerms, setRevisionTerms] = useState("Up to 2 standard revision rounds included per deliverable.");
  const [cancellationTerms, setCancellationTerms] = useState("Either party may terminate with 7 days written notice. Payment prorated for completed work.");
  const [termsText, setTermsText] = useState(
    "1. Scope of Engagement: Freelancer agrees to provide creative services as outlined in the Scope of Work.\n" +
    "2. Intellectual Property: Upon full payment, all intellectual property rights in deliverables transfer to Business.\n" +
    "3. Confidentiality: Both parties agree to maintain strict confidentiality regarding proprietary materials.\n" +
    "4. Warranties: Freelancer warrants that work is original and does not infringe third-party rights.\n" +
    "5. Escrow Protection: All milestone payments are held securely in Crewn platform escrow until approved."
  );
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Contract title is required");
      return;
    }
    if (totalAmount === "" || Number(totalAmount) < 0) {
      setError("Please provide a valid contract amount");
      return;
    }
    if (!termsText.trim()) {
      setError("Master terms text is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          totalAmount: Number(totalAmount),
          scopeOfWork: scopeOfWork.trim(),
          deliverablesText: deliverablesText.trim(),
          paymentTerms: paymentTerms.trim(),
          revisionTerms: revisionTerms.trim(),
          cancellationTerms: cancellationTerms.trim(),
          termsText: termsText.trim(),
          effectiveDate: effectiveDate || null,
          expiresAt: expiresAt || null,
          freelancerId: defaultFreelancerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contract draft");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Draft Production Contract</h3>
              <p className="text-xs text-muted-foreground">
                Formal legal agreement with server-side party binding and digital signature audit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Contract Title *
              </label>
              <input
                type="text"
                id="contract-title-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Creative Production Agreement"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Total Contract Amount (₹) *
              </label>
              <input
                type="number"
                id="contract-amount-input"
                required
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 50000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Scope of Work
              </label>
              <textarea
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                rows={3}
                placeholder="Detailed description of project deliverables and creative requirements..."
                className="w-full p-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Deliverables Summary
              </label>
              <textarea
                value={deliverablesText}
                onChange={(e) => setDeliverablesText(e.target.value)}
                rows={3}
                placeholder="Key deliverables, file formats, and expected resolutions..."
                className="w-full p-3 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Payment Terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Revision Policy
              </label>
              <input
                type="text"
                value={revisionTerms}
                onChange={(e) => setRevisionTerms(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Cancellation & Termination Policy
            </label>
            <input
              type="text"
              value={cancellationTerms}
              onChange={(e) => setCancellationTerms(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Effective Date
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Master Terms & Conditions *
            </label>
            <textarea
              required
              rows={4}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              className="w-full p-3 rounded-xl border border-input bg-background text-xs text-foreground font-mono focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-contract-btn"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? "Creating Draft..." : "Create Contract Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
