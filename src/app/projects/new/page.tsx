"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Briefcase, Calendar, DollarSign, FileText } from "lucide-react";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    currency: "INR",
    deadline: "",
    status: "DRAFT" as "DRAFT" | "OPEN",
  });

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Project title is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          budgetMin: form.budgetMin ? parseFloat(form.budgetMin) : null,
          budgetMax: form.budgetMax ? parseFloat(form.budgetMax) : null,
          currency: form.currency,
          deadline: form.deadline || null,
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create project");
        return;
      }

      router.push(`/projects/${data.project.id}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="New Project"
        subtitle="Create a campaign brief to start inviting creators and tracking progress"
      />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Projects
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Briefcase className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Campaign Brief</CardTitle>
                <CardDescription className="text-xs">
                  You can add milestones, tasks, and invite creators after creating the project.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" id="new-project-form">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Project Title <span className="text-destructive">*</span>
                </label>
                <Input
                  id="project-title"
                  placeholder="e.g. Q4 Social Media Campaign — Diwali 2025"
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  maxLength={200}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">{form.title.length}/200</p>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Description
                </label>
                <textarea
                  id="project-description"
                  className="w-full min-h-[100px] resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Describe the campaign goals, target audience, and expected deliverables..."
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  maxLength={5000}
                />
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  Budget Range (optional)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="project-currency"
                    value={form.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="GBP">£ GBP</option>
                  </select>
                  <Input
                    id="project-budget-min"
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={form.budgetMin}
                    onChange={(e) => handleChange("budgetMin", e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    id="project-budget-max"
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={form.budgetMax}
                    onChange={(e) => handleChange("budgetMax", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Deadline (optional)
                </label>
                <Input
                  id="project-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => handleChange("deadline", e.target.value)}
                />
              </div>

              {/* Initial status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Initial Status
                </label>
                <div className="flex items-center gap-2">
                  {(["DRAFT", "OPEN"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      id={`status-${s.toLowerCase()}`}
                      onClick={() => handleChange("status", s)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        form.status === s
                          ? "border-foreground bg-secondary text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {s === "DRAFT" ? "Save as Draft" : "Open for Applications"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {form.status === "DRAFT"
                    ? "Drafts are only visible to your organization."
                    : "Open projects can accept creator invitations immediately."}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Link href="/projects">
                  <Button variant="outline" size="sm" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button
                  variant="default"
                  size="sm"
                  type="submit"
                  disabled={loading}
                  className="gap-1.5 min-w-[120px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Briefcase className="h-3.5 w-3.5" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preview badge */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" size="sm">Status: {form.status}</Badge>
          <span>•</span>
          <span>After creating, you can add milestones, invite creators, and assign tasks.</span>
        </div>
      </main>
    </div>
  );
}
