"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Wallet,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Landmark,
  PlusCircle,
} from "lucide-react";
import { formatINR } from "@/lib/payments/currency";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EarningsClientProps {
  summary: {
    escrowHeld: number;
    pendingPayouts: number;
    clearedEarnings: number;
    lifetimeEarnings: number;
    currency: string;
  };
  payouts: Array<{
    id: string;
    payoutReference: string | null;
    amount: number;
    currency: string;
    status: string;
    payoutMethod: string;
    processedAt: string | null;
    createdAt: string;
    milestoneTitle: string | null;
    projectTitle: string | null;
    projectId: string | null;
  }>;
  escrowMilestones: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    escrowHeldAt: string | null;
    milestoneTitle: string;
    projectTitle: string;
    projectId: string;
  }>;
  bankAccount: {
    accountHolderName: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string | null;
    upiId: string | null;
    isVerified: boolean;
  } | null;
}

export function FreelancerEarningsClient({
  summary,
  payouts,
  escrowMilestones,
  bankAccount: initialBankAccount,
}: EarningsClientProps) {
  const router = useRouter();
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankAccount, setBankAccount] = useState(initialBankAccount);

  const [holderName, setHolderName] = useState(initialBankAccount?.accountHolderName || "");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState(initialBankAccount?.ifscCode || "");
  const [bankName, setBankName] = useState(initialBankAccount?.bankName || "");
  const [upiId, setUpiId] = useState(initialBankAccount?.upiId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/freelancer/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountHolderName: holderName,
          accountNumber,
          ifscCode: ifsc,
          bankName,
          upiId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save bank account");
      }

      setBankAccount(data.bankAccount);
      setSuccess("Payout bank account updated successfully!");
      setTimeout(() => {
        setBankModalOpen(false);
        router.refresh();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update bank details";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Secured in Escrow</span>
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatINR(summary.escrowHeld)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              {escrowMilestones.length} milestone{escrowMilestones.length === 1 ? "" : "s"} funded by clients
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Pending Disbursements</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatINR(summary.pendingPayouts)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Released funds queueing for payout
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Cleared Earnings</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatINR(summary.clearedEarnings)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Directly deposited to your bank
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Lifetime Volume</span>
              <Wallet className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {formatINR(summary.lifetimeEarnings)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">
              Gross creator earnings on Crewn
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account / Payout Destination Card */}
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Payout Destination Account
            </CardTitle>
            <CardDescription className="text-xs">
              Where your cleared milestone earnings are deposited.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBankModalOpen(true)}
            className="text-xs gap-1.5"
          >
            {bankAccount ? "Update Bank Details" : "Add Bank Account"}
          </Button>
        </CardHeader>
        <CardContent>
          {bankAccount ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-secondary/20 p-3">
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {bankAccount.accountHolderName}
                  <Badge variant="outline" size="sm" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    Verified
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {bankAccount.bankName ? `${bankAccount.bankName} • ` : ""}
                  {bankAccount.accountNumberMasked}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="text-muted-foreground">IFSC: <span className="font-mono text-foreground">{bankAccount.ifscCode}</span></p>
                {bankAccount.upiId && (
                  <p className="text-muted-foreground">UPI: <span className="font-mono text-foreground">{bankAccount.upiId}</span></p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No bank account configured yet. Add your account details to receive cleared milestone payouts.
              </p>
              <Button
                size="sm"
                className="mt-2 text-xs gap-1"
                onClick={() => setBankModalOpen(true)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add Bank Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid: Active Escrow Milestones | Payout History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Escrow Milestones */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              Active Escrow Milestones ({escrowMilestones.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Funds locked by clients, awaiting deliverable completion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {escrowMilestones.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No funds currently held in escrow.
              </p>
            ) : (
              escrowMilestones.map((ms) => (
                <div key={ms.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{ms.milestoneTitle}</p>
                    <Link
                      href={`/projects/${ms.projectId}`}
                      className="text-[11px] text-primary hover:underline truncate block"
                    >
                      {ms.projectTitle}
                    </Link>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {formatINR(ms.amount)}
                    </p>
                    <Badge variant="outline" size="sm" className="text-[9px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                      Held in Escrow
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Payout History */}
        <Card className="border border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-500" />
              Payout History ({payouts.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Disbursements from completed and approved milestones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {payouts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No payouts recorded yet.
              </p>
            ) : (
              payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {p.milestoneTitle || "Milestone Payout"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.payoutReference || "Pending Reference"} • {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-foreground">
                      {formatINR(p.amount)}
                    </p>
                    <Badge
                      variant="outline"
                      size="sm"
                      className={`text-[9px] ${
                        p.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank Account Modal */}
      <Dialog open={bankModalOpen} onOpenChange={setBankModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              {bankAccount ? "Update Bank Account" : "Add Payout Destination"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your Indian bank account details for direct milestone disbursements.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBank} className="space-y-3 pt-2">
            {error && (
              <div className="flex items-center gap-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground">Beneficiary Name (as per Bank)</label>
              <Input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Full Name"
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Bank Account Number</label>
              <Input
                type="password"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter complete account number"
                className="mt-1 text-xs font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-foreground">IFSC Code</label>
                <Input
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  className="mt-1 text-xs font-mono uppercase"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Bank Name (Optional)</label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">UPI ID (Optional)</label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="username@okhdfcbank"
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBankModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="text-xs gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Account Details
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
