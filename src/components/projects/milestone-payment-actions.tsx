"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/payments/currency";

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface MilestonePaymentActionsProps {
  milestoneId: string;
  milestoneTitle: string;
  amount: number;
  currency: string;
  milestoneStatus: string;
  paymentStatus?: string | null;
  isBusinessMember: boolean;
  isFreelancer: boolean;
  assignedFreelancerName?: string | null;
  currentUserEmail?: string;
  currentUserName?: string;
}

export function MilestonePaymentActions({
  milestoneId,
  milestoneTitle,
  amount,
  currency,
  milestoneStatus,
  paymentStatus,
  isBusinessMember,
  isFreelancer,
  assignedFreelancerName,
  currentUserEmail = "",
  currentUserName = "",
}: MilestonePaymentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isHeldInEscrow = paymentStatus === "HELD_IN_ESCROW";
  const isReleasedOrPaid = paymentStatus === "RELEASED" || milestoneStatus === "PAID";

  // 1. Handle Fund Escrow via Razorpay
  const handleFundEscrow = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Step A: Create order on server
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to create payment order");
      }

      const { orderId, amountPaise, keyId } = orderData;

      // Step B: Load Razorpay Checkout Script
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Failed to load Razorpay secure checkout script");
      }

      // Step C: Open Razorpay Checkout Modal
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: currency || "INR",
        name: "Crewn Escrow",
        description: `Escrow funding for "${milestoneTitle}"`,
        order_id: orderId,
        prefill: {
          name: currentUserName,
          email: currentUserEmail,
        },
        theme: {
          color: "#4f46e5",
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            setLoading(true);
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Payment verification failed");
            }

            setSuccessMsg("Payment verified! Funds are now securely held in escrow.");
            router.refresh();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to verify payment";
            setError(msg);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const RazorpayConstructor = (window as unknown as { Razorpay: new (opts: unknown) => RazorpayCheckoutInstance }).Razorpay;
      const rzp = new RazorpayConstructor(options);
      rzp.on("payment.failed", function (response: { error?: { description?: string } }) {
        setError(`Payment failed: ${response.error?.description || "Gateway transaction declined"}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error initiating payment";
      setError(msg);
      setLoading(false);
    }
  };

  // 2. Handle Release Escrow to Freelancer
  const handleReleaseEscrow = async () => {
    if (!confirm(`Are you sure you want to approve this milestone and release ${formatINR(amount)} to the specialist? This action cannot be reversed.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/payments/milestones/${milestoneId}/release`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to release escrow");
      }

      setSuccessMsg(`Escrow released! Payout ref: ${data.payout?.payoutReference || "Success"}`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to release escrow";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-2 border-t border-border/60 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <span>{formatINR(amount)}</span>
          {assignedFreelancerName && (
            <span className="text-[10px] text-muted-foreground font-normal">
              → {assignedFreelancerName}
            </span>
          )}
        </div>

        {/* Status Badges */}
        {isReleasedOrPaid ? (
          <Badge variant="outline" size="sm" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid & Cleared
          </Badge>
        ) : isHeldInEscrow ? (
          <Badge variant="outline" size="sm" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-[10px] flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            In Escrow
          </Badge>
        ) : (
          <Badge variant="secondary" size="sm" className="text-[10px]">
            Unfunded
          </Badge>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 p-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 p-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {isBusinessMember && !isHeldInEscrow && !isReleasedOrPaid && (
          <Button
            size="sm"
            onClick={handleFundEscrow}
            disabled={loading}
            className="w-full text-xs h-7 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="h-3.5 w-3.5" />
            )}
            Fund Escrow ({formatINR(amount)})
          </Button>
        )}

        {isBusinessMember && isHeldInEscrow && (
          <Button
            size="sm"
            onClick={handleReleaseEscrow}
            disabled={loading}
            className="w-full text-xs h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Approve & Release Escrow
          </Button>
        )}

        {isFreelancer && isHeldInEscrow && (
          <div className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-500/5 rounded border border-indigo-500/10">
            <ShieldCheck className="h-3.5 w-3.5" />
            Funds secured in escrow by client
          </div>
        )}
      </div>
    </div>
  );
}
