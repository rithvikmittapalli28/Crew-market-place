"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Lock, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage("Missing or invalid password reset token. Please request a new link.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to reset password.");
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Login</span>
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
            Choose a New Password
          </h1>
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters, containing letters and numbers.
          </p>
        </div>

        <Card>
          {isSuccess ? (
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-pastel-green-subtle text-emerald-600 dark:text-emerald-400 border border-pastel-green-border">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Password Updated</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account password has been updated securely. All previous active sessions have been signed out.
              </p>
              <Link href="/login" className="block pt-2">
                <Button variant="default" size="md" className="w-full font-semibold">
                  Sign In with New Password
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle className="text-base">Reset Account Password</CardTitle>
                <CardDescription className="text-xs">
                  Create a new secure password for your Crewn workspace
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {(!token || errorMessage) && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive dark:text-red-400"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMessage || "Invalid password reset link. Please request a new link from the forgot password page."}</span>
                  </div>
                )}

                <Input
                  label="New Password"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  startIcon={<Lock className="h-4 w-4" />}
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Re-enter your new password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  startIcon={<Lock className="h-4 w-4" />}
                />
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  variant="default"
                  size="md"
                  className="w-full font-semibold"
                  disabled={!token}
                  isLoading={isSubmitting}
                >
                  Save New Password
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  <Link
                    href="/login"
                    className="font-semibold text-foreground hover:underline"
                  >
                    Cancel and Return to Sign In
                  </Link>
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
