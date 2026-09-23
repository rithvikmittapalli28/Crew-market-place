"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { Mail, Lock, User, Building2, Sparkles, ArrowLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "freelancer" ? "FREELANCER" : "BUSINESS";
  const { refreshUser } = useAuth();

  const [role, setRole] = React.useState<"BUSINESS" | "FREELANCER">(initialRole);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const firstErr = Object.values(data.details)[0];
          setErrorMessage(Array.isArray(firstErr) ? firstErr[0] : (data.error || "Registration failed."));
        } else {
          setErrorMessage(data.error || "Failed to create account. Please check your details.");
        }
        setIsSubmitting(false);
        return;
      }

      await refreshUser();

      // Flow: registration -> limited authenticated state -> email verification -> onboarding -> normal access
      router.push("/verify-email");
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
            Join the Crewn Network
          </h1>
          <p className="text-xs text-muted-foreground">
            Select your account type to set up your production workspace.
          </p>
        </div>

        {/* Role Toggle */}
        <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-secondary/80 border border-border/80">
          <button
            type="button"
            onClick={() => setRole("BUSINESS")}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-all duration-150 cursor-pointer",
              role === "BUSINESS"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="h-4 w-4" />
            <span>Hire as Business</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("FREELANCER")}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-all duration-150 cursor-pointer",
              role === "FREELANCER"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4 text-pastel-pink" />
            <span>Join as Creator</span>
          </button>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-base">
                {role === "BUSINESS" ? "Create Business Account" : "Create Creator Profile"}
              </CardTitle>
              <CardDescription className="text-xs">
                {role === "BUSINESS"
                  ? "Set up your business entity, invite team members, post briefs, and fund milestones"
                  : "Showcase your portfolio, list your services, and receive direct inquiries"}
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
                label="Full Name or Business Entity"
                type="text"
                placeholder={role === "BUSINESS" ? "e.g. Lumina Studio or Jane Doe" : "e.g. Aarav Sharma"}
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                startIcon={<User className="h-4 w-4" />}
              />

              <Input
                label="Work Email"
                type="email"
                placeholder="name@company.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                startIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="Create Password"
                type="password"
                placeholder="At least 8 characters (with letter & number)"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                startIcon={<Lock className="h-4 w-4" />}
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
                {role === "BUSINESS" ? "Get Started as a Business" : "Apply as a Creator"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-foreground hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterContent />
    </React.Suspense>
  );
}
