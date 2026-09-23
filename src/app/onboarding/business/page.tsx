"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { Building2, Globe, FileText, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Fashion & Apparel",
  "Consumer Brands & D2C",
  "Technology & SaaS",
  "Media & Entertainment",
  "Food & Beverage",
  "Luxury & Lifestyle",
  "Health & Wellness",
  "Creative Agency",
  "Other",
];

const COMPANY_SIZES = [
  { label: "1 - 10 employees (Startup / Boutique)", value: "1-10" },
  { label: "11 - 50 employees (Growing Venture)", value: "11-50" },
  { label: "51 - 200 employees (Mid-Market Brand)", value: "51-200" },
  { label: "200+ employees (Enterprise)", value: "200+" },
];

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [name, setName] = React.useState(user?.name ? `${user.name} Studio` : "");
  const [legalName, setLegalName] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [industry, setIndustry] = React.useState(INDUSTRIES[0]);
  const [companySize, setCompanySize] = React.useState("1-10");
  const [description, setDescription] = React.useState("");
  const [taxId, setTaxId] = React.useState("");

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (step === 1) {
      if (!name.trim()) {
        setErrorMessage("Business name is required.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!industry || !companySize) {
        setErrorMessage("Please select your industry and company size.");
        return;
      }
      setStep(3);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        legalName: legalName.trim() || undefined,
        website: website.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        industry,
        companySize,
        description: description.trim() || undefined,
        taxId: taxId.trim() || undefined,
      };

      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const firstErr = Object.values(data.details)[0];
          setErrorMessage(Array.isArray(firstErr) ? firstErr[0] : (data.error || "Onboarding failed"));
        } else {
          setErrorMessage(data.error || "Failed to set up business profile.");
        }
        setIsSubmitting(false);
        return;
      }

      await refreshUser();
      router.push("/business");
      router.refresh();
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
      <div className="absolute top-6 left-6">
        <Link href="/" className="inline-block text-xl font-bold tracking-tight text-foreground">
          crewn<span className="text-pastel-pink font-serif">.</span>
        </Link>
      </div>

      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-xl space-y-6">
        {/* Progress Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-pastel-pink">
                Organization Setup
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Set up your business workspace
              </h1>
            </div>
            <Badge variant="pastel-yellow" size="sm">
              Step {step} of 3
            </Badge>
          </div>

          {/* Stepper Dots / Bars */}
          <div className="grid grid-cols-3 gap-2">
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 1 ? "bg-foreground" : "bg-muted")} />
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 2 ? "bg-foreground" : "bg-muted")} />
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 3 ? "bg-foreground" : "bg-muted")} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {step === 1 && "Business & Brand Identity"}
              {step === 2 && "Industry & Scale"}
              {step === 3 && "Tax & Legal Compliance"}
            </CardTitle>
            <CardDescription className="text-xs">
              {step === 1 && "Define the company profile that creators and collaborators will see."}
              {step === 2 && "Help Crewn tailor recommended creators, contracts, and briefs."}
              {step === 3 && "Optional invoice details for automated escrow and tax compliance."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMessage && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive dark:text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {step === 1 && (
              <form id="step-1-form" onSubmit={handleNextStep} className="space-y-4">
                <Input
                  label="Business / Brand Name"
                  placeholder="e.g. Lumina Studio"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  startIcon={<Building2 className="h-4 w-4" />}
                />

                <Input
                  label="Legal Entity Name (Optional)"
                  placeholder="e.g. Lumina Technologies Pvt Ltd"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  startIcon={<FileText className="h-4 w-4" />}
                />

                <Input
                  label="Official Website (Optional)"
                  type="url"
                  placeholder="https://lumina.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  startIcon={<Globe className="h-4 w-4" />}
                />

                <Input
                  label="Brand Logo URL (Optional)"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </form>
            )}

            {step === 2 && (
              <form id="step-2-form" onSubmit={handleNextStep} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Primary Industry</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => setIndustry(ind)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all duration-150 cursor-pointer",
                          industry === ind
                            ? "border-foreground bg-foreground text-background font-semibold"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Company Size</label>
                  <div className="space-y-2">
                    {COMPANY_SIZES.map((cs) => (
                      <button
                        key={cs.value}
                        type="button"
                        onClick={() => setCompanySize(cs.value)}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl border p-3 text-left text-xs transition-all duration-150 cursor-pointer",
                          companySize === cs.value
                            ? "border-foreground bg-secondary/80 font-semibold text-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span>{cs.label}</span>
                        {companySize === cs.value && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Organization Overview (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe what your brand builds and the kind of creative work you commission..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </form>
            )}

            {step === 3 && (
              <form id="step-3-form" onSubmit={handleFinalSubmit} className="space-y-4">
                <Input
                  label="Tax ID / GSTIN / VAT Number (Optional)"
                  placeholder="e.g. 27AABCU9603R1ZM"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />

                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
                  <h3 className="text-xs font-bold text-foreground">Summary of New Organization</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><span className="font-semibold text-foreground">Name:</span> {name}</p>
                    <p><span className="font-semibold text-foreground">Industry:</span> {industry}</p>
                    <p><span className="font-semibold text-foreground">Scale:</span> {companySize} team members</p>
                    {website && <p><span className="font-semibold text-foreground">Website:</span> {website}</p>}
                  </div>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border pt-4">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="gap-1 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button
                type="submit"
                form={`step-${step}-form`}
                variant="default"
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                form="step-3-form"
                variant="default"
                size="sm"
                isLoading={isSubmitting}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Launch Business Workspace</span>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
