"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Mail, ArrowLeft, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to process request. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
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
            Reset Account Password
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your email to receive secure password recovery instructions.
          </p>
        </div>

        <Card>
          {submitted ? (
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-pastel-green-subtle text-emerald-600 dark:text-emerald-400 border border-pastel-green-border">
                <Mail className="h-6 w-6" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Check your inbox</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>, you will receive password recovery instructions shortly.
              </p>
              <Link href="/login" className="block pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle className="text-base">Password Recovery</CardTitle>
                <CardDescription className="text-xs">
                  We will send a verified reset link to your email.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive dark:text-red-400"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <Input
                  label="Registered Email Address"
                  type="email"
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  startIcon={<Mail className="h-4 w-4" />}
                />
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  variant="default"
                  size="md"
                  className="w-full font-semibold"
                  isLoading={isSubmitting}
                >
                  Send Reset Link
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-foreground hover:underline"
                  >
                    Sign In
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
