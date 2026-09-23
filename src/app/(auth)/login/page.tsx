"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { Mail, Lock, ArrowLeft, AlertCircle } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const { refreshUser } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to sign in. Please verify your credentials.");
        setIsSubmitting(false);
        return;
      }

      await refreshUser();

      // Determine redirect destination
      const user = data.user;
      if (!user.onboarded) {
        if (user.role === "BUSINESS") {
          router.push("/onboarding/business");
        } else if (user.role === "FREELANCER") {
          router.push("/onboarding/freelancer");
        } else {
          router.push("/admin");
        }
      } else {
        if (from && from.startsWith("/")) {
          router.push(from);
        } else if (user.role === "BUSINESS") {
          router.push("/business");
        } else if (user.role === "FREELANCER") {
          router.push("/freelancer");
        } else if (user.role === "ADMIN") {
          router.push("/admin");
        } else {
          router.push("/");
        }
      }
      router.refresh();
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

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
            Welcome back to your creative workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to manage briefs, milestones, and deliverables.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-base">Account Sign In</CardTitle>
              <CardDescription className="text-xs">
                Enter your registered business or creator email
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
                label="Work or Personal Email"
                type="email"
                placeholder="name@company.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                startIcon={<Mail className="h-4 w-4" />}
              />

              <div className="space-y-1">
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  startIcon={<Lock className="h-4 w-4" />}
                />
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                variant="default"
                size="md"
                className="w-full font-semibold"
                isLoading={isSubmitting}
              >
                Sign In to Crewn
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Don&apos;t have an account yet?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-foreground hover:underline"
                >
                  Join as Brand or Creator
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginContent />
    </React.Suspense>
  );
}
