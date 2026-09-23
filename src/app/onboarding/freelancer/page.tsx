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
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_POPULAR_SKILLS = [
  "Commercial Cinematography",
  "DaVinci Resolve",
  "Color Grading",
  "Brand Identity",
  "Motion Graphics",
  "Editorial Photography",
  "Creative Direction",
  "Copywriting",
  "UI/UX Design",
  "3D Animation",
  "Sound Design",
  "Drone Cinematography",
];

export default function FreelancerOnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  // Step 1: Creative Identity
  const [headline, setHeadline] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [yearsExperience, setYearsExperience] = React.useState("4");
  const [bio, setBio] = React.useState("");
  const [website, setWebsite] = React.useState("");

  // Step 2: Skills
  const [selectedSkills, setSelectedSkills] = React.useState<string[]>([
    "Commercial Cinematography",
    "Color Grading",
  ]);
  const [customSkillInput, setCustomSkillInput] = React.useState("");

  // Step 3: Availability & Starter Service
  const [hourlyRate, setHourlyRate] = React.useState("2500");
  const [hoursPerWeek, setHoursPerWeek] = React.useState("40");
  const [availabilityStatus, setAvailabilityStatus] = React.useState<
    "AVAILABLE" | "PARTIALLY_AVAILABLE" | "BUSY" | "UNAVAILABLE"
  >("AVAILABLE");
  const [serviceTitle, setServiceTitle] = React.useState("60-Second Brand Commercial");
  const [servicePrice, setServicePrice] = React.useState("45000");
  const [serviceDeliveryDays, setServiceDeliveryDays] = React.useState("7");
  const [serviceDescription, setServiceDescription] = React.useState(
    "Full-cycle commercial production including storyboard review, 4K filming, color grading, and licensed audio mixing."
  );

  // Step 4: Portfolio Item
  const [portfolioTitle, setPortfolioTitle] = React.useState("Autumn Apparel Visual Campaign");
  const [portfolioMediaType, setPortfolioMediaType] = React.useState<"IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT">("VIDEO");
  const [portfolioUrl, setPortfolioUrl] = React.useState("https://vimeo.com/76979871");

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const addCustomSkill = () => {
    if (customSkillInput.trim() && !selectedSkills.includes(customSkillInput.trim())) {
      setSelectedSkills([...selectedSkills, customSkillInput.trim()]);
      setCustomSkillInput("");
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (step === 1) {
      if (!headline.trim()) {
        setErrorMessage("Professional headline is required.");
        return;
      }
      if (bio.trim().length < 20) {
        setErrorMessage("Bio must be at least 20 characters long.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedSkills.length === 0) {
        setErrorMessage("Please select or add at least one core creative skill.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!serviceTitle.trim() || !servicePrice) {
        setErrorMessage("Please configure a starter service package for client inquiries.");
        return;
      }
      setStep(4);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        headline,
        bio,
        location: location.trim() || undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        yearsExperience: Number(yearsExperience) || 1,
        website: website.trim() || undefined,
        availabilityStatus,
        hoursPerWeek: Number(hoursPerWeek) || 40,
        skills: selectedSkills,
        services: serviceTitle.trim()
          ? [
              {
                title: serviceTitle.trim(),
                description: serviceDescription.trim() || "Standard creative package",
                basePrice: Number(servicePrice) || 10000,
                deliveryDays: Number(serviceDeliveryDays) || 7,
                revisionLimit: 2,
              },
            ]
          : undefined,
        portfolioItems: portfolioTitle.trim()
          ? [
              {
                title: portfolioTitle.trim(),
                mediaType: portfolioMediaType,
                externalUrl: portfolioUrl.trim() || undefined,
              },
            ]
          : undefined,
      };

      const res = await fetch("/api/onboarding/freelancer", {
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
          setErrorMessage(data.error || "Failed to set up creator profile.");
        }
        setIsSubmitting(false);
        return;
      }

      await refreshUser();
      router.push("/freelancer");
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
                Creator Studio Onboarding
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                Set up your creator profile
              </h1>
            </div>
            <Badge variant="pastel-yellow" size="sm">
              Step {step} of 4
            </Badge>
          </div>

          {/* Stepper Bars */}
          <div className="grid grid-cols-4 gap-2">
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 1 ? "bg-foreground" : "bg-muted")} />
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 2 ? "bg-foreground" : "bg-muted")} />
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 3 ? "bg-foreground" : "bg-muted")} />
            <div className={cn("h-1.5 rounded-full transition-all duration-300", step >= 4 ? "bg-foreground" : "bg-muted")} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {step === 1 && "Creative Discipline & Identity"}
              {step === 2 && "Skills & Specializations"}
              {step === 3 && "Availability & Starter Service"}
              {step === 4 && "Featured Portfolio Item"}
            </CardTitle>
            <CardDescription className="text-xs">
              {step === 1 && "Highlight your creative craft, editorial title, and background."}
              {step === 2 && "Tag your technical and creative proficiencies for matching."}
              {step === 3 && "Set your hourly rate and define a packaged starter service."}
              {step === 4 && "Showcase a link to your signature commercial or creative work."}
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

            {/* Step 1: Discipline & Identity */}
            {step === 1 && (
              <form id="creator-step-1" onSubmit={handleNextStep} className="space-y-4">
                <Input
                  label="Professional Headline / Craft"
                  placeholder="e.g. Commercial Cinematographer & Colorist"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  startIcon={<Sparkles className="h-4 w-4 text-pastel-pink" />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Primary Location / Studio Base"
                    placeholder="e.g. Mumbai, India / Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <Input
                    label="Years of Experience"
                    type="number"
                    min={0}
                    max={50}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Creative Bio & Aesthetic Philosophy (Min 20 characters)
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell brands about your artistic voice, visual tone, camera gear, and notable campaign history..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {bio.length} / 20 characters min
                  </span>
                </div>

                <Input
                  label="Portfolio / Reel URL (Optional)"
                  type="url"
                  placeholder="https://aaravfilms.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  startIcon={<ExternalLink className="h-4 w-4" />}
                />
              </form>
            )}

            {/* Step 2: Skills */}
            {step === 2 && (
              <form id="creator-step-2" onSubmit={handleNextStep} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    Select Your Specialized Skills
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_POPULAR_SKILLS.map((sk) => {
                      const isSelected = selectedSkills.includes(sk);
                      return (
                        <button
                          key={sk}
                          type="button"
                          onClick={() => toggleSkill(sk)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer border",
                            isSelected
                              ? "bg-foreground text-background border-foreground font-semibold"
                              : "bg-secondary/60 text-muted-foreground border-border/80 hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          {sk}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Skill Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Add Custom Skill</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Unreal Engine 5, RED Komodo"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomSkill();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomSkill}
                      className="gap-1 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </Button>
                  </div>
                </div>

                {/* Selected Skills Badges */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Active Skills ({selectedSkills.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSkills.map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center gap-1 rounded-md bg-card border border-border px-2 py-0.5 text-xs text-foreground font-medium"
                      >
                        <span>{sk}</span>
                        <button
                          type="button"
                          onClick={() => toggleSkill(sk)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </form>
            )}

            {/* Step 3: Rates, Availability & Service Package */}
            {step === 3 && (
              <form id="creator-step-3" onSubmit={handleNextStep} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Standard Hourly Rate (₹ INR)"
                    type="number"
                    min={100}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="2500"
                  />
                  <Input
                    label="Weekly Available Hours"
                    type="number"
                    min={5}
                    max={168}
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    placeholder="40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Current Availability Status</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { label: "Available Now", value: "AVAILABLE" as const },
                        { label: "Partially Available", value: "PARTIALLY_AVAILABLE" as const },
                        { label: "Booked Out", value: "BUSY" as const },
                      ]
                    ).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setAvailabilityStatus(item.value)}
                        className={cn(
                          "rounded-xl border p-2.5 text-xs font-medium text-center transition-all cursor-pointer",
                          availabilityStatus === item.value
                            ? "border-foreground bg-foreground text-background font-semibold"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-pastel-pink" />
                    <h3 className="text-xs font-bold text-foreground">Starter Deliverable Package</h3>
                  </div>
                  <Input
                    label="Package Title"
                    placeholder="e.g. 60-Second Commercial Film"
                    required
                    value={serviceTitle}
                    onChange={(e) => setServiceTitle(e.target.value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Package Price (₹ INR)"
                      type="number"
                      required
                      value={servicePrice}
                      onChange={(e) => setServicePrice(e.target.value)}
                    />
                    <Input
                      label="Delivery Days"
                      type="number"
                      min={1}
                      required
                      value={serviceDeliveryDays}
                      onChange={(e) => setServiceDeliveryDays(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">Package Scope Description</label>
                    <textarea
                      rows={2}
                      value={serviceDescription}
                      onChange={(e) => setServiceDescription(e.target.value)}
                      className="w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </form>
            )}

            {/* Step 4: Portfolio Showcase */}
            {step === 4 && (
              <form id="creator-step-4" onSubmit={handleFinalSubmit} className="space-y-4">
                <Input
                  label="Featured Work Title"
                  placeholder="e.g. Autumn Apparel Visual Campaign"
                  required
                  value={portfolioTitle}
                  onChange={(e) => setPortfolioTitle(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Media Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["VIDEO", "IMAGE", "AUDIO", "DOCUMENT"] as const).map((mt) => (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => setPortfolioMediaType(mt)}
                        className={cn(
                          "rounded-lg border py-2 text-center text-xs font-medium transition-all cursor-pointer",
                          portfolioMediaType === mt
                            ? "border-foreground bg-foreground text-background font-semibold"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {mt}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="External Reel / Project Link"
                  type="url"
                  placeholder="https://vimeo.com/... or https://behance.net/..."
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  startIcon={<ExternalLink className="h-4 w-4" />}
                />

                <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2">
                  <h3 className="text-xs font-bold text-foreground">Ready to Publish</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><span className="font-semibold text-foreground">Headline:</span> {headline}</p>
                    <p><span className="font-semibold text-foreground">Rate:</span> ₹{hourlyRate}/hr • {hoursPerWeek} hrs/week</p>
                    <p><span className="font-semibold text-foreground">Skills:</span> {selectedSkills.slice(0, 4).join(", ")}...</p>
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
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="gap-1 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                type="submit"
                form={`creator-step-${step}`}
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
                form="creator-step-4"
                variant="default"
                size="sm"
                isLoading={isSubmitting}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Complete Creator Setup</span>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
