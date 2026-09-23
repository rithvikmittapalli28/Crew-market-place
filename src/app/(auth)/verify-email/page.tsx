"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CheckCircle2, AlertCircle, ArrowLeft, Loader2, MailCheck, Mail } from "lucide-react";
import { useAuth } from "@/context/auth-context";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const { user, refreshUser } = useAuth();

  const [status, setStatus] = React.useState<"pending_notice" | "verifying" | "success" | "error">(
    token ? "verifying" : "pending_notice"
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [verifiedRole, setVerifiedRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;

    let isMounted = true;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(async ({ ok, data }) => {
        if (!isMounted) return;
        if (ok) {
          setStatus("success");
          setVerifiedRole(data.user?.role || null);
          await refreshUser();
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Verification failed. The link may have expired or already been used.");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage("Network error during email verification.");
      });

    return () => {
      isMounted = false;
    };
  }, [token, refreshUser]);

  const targetOnboardingUrl =
    (verifiedRole || user?.role) === "FREELANCER"
      ? "/onboarding/freelancer"
      : "/onboarding/business";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Crewn Home</span>
          </Button>
        </Link>
      </div>

      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <Link href="/" className="inline-block text-2xl font-bold tracking-tight text-foreground mb-2">
            crewn<span className="text-pastel-pink font-serif">.</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Email Verification
          </h1>
          <p className="text-xs text-muted-foreground">
            Validating your official email address on the Crewn platform.
          </p>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-base">Account Security Gate</CardTitle>
            <CardDescription className="text-xs">
              Confirming ownership of your workspace email
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2 text-center">
            {status === "pending_notice" && (
              <div className="py-4 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-pastel-blue-subtle text-blue-600 dark:text-blue-400 border border-pastel-blue-border">
                  <Mail className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground">Verification Required</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We have sent a verification link to your registered email address.
                    Please check your inbox (or development console) and click the link to verify your account before accessing onboarding or dashboards.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      Sign in with another account
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {status === "verifying" && (
              <div className="py-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-foreground" />
                <p className="text-xs text-muted-foreground">
                  Validating your cryptographic verification token...
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="py-4 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-pastel-green-subtle text-emerald-600 dark:text-emerald-400 border border-pastel-green-border">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground">Email Verified!</h2>
                  <p className="text-xs text-muted-foreground">
                    Your email address has been confirmed successfully. You can now proceed to set up your workspace profile.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    variant="default"
                    size="md"
                    className="w-full font-semibold gap-1.5"
                    onClick={() => router.push(targetOnboardingUrl)}
                  >
                    <MailCheck className="h-4 w-4" />
                    <span>Proceed to Onboarding</span>
                  </Button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="py-4 space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive dark:text-red-400 border border-destructive/20">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground">Verification Failed</h2>
                  <p className="text-xs text-muted-foreground">
                    {errorMessage || "The link may be invalid, expired, or has already been used."}
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      Return to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VerifyEmailContent />
    </React.Suspense>
  );
}
