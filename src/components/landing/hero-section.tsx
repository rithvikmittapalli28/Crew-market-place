"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-16 md:pb-24">
      {/* Subtle background ambient glow (not heavy gradient) */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20 blur-3xl dark:opacity-10"
        style={{
          background:
            "radial-gradient(circle, rgba(244, 114, 182, 0.4) 0%, rgba(96, 165, 250, 0.3) 50%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center sm:text-left">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          
          {/* Left Column: Editorial Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Minimal Badge */}
            <div className="inline-flex items-center gap-2">
              <Badge variant="pastel-pink" size="md" className="rounded-full px-3 py-1 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>The Curated Creative Marketplace</span>
              </Badge>
              <Badge variant="outline" size="md" className="hidden sm:inline-flex rounded-full text-xs font-normal">
                v1.0 Production Architecture
              </Badge>
            </div>

            {/* Editorial Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl leading-[1.08]">
              Where visionary brands hire{" "}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/80">
                elite creative minds
              </span>
              <span className="text-pastel-pink font-serif">.</span>
            </h1>

            {/* Editorial Subtitle */}
            <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              Crewn bridges premier companies with handpicked commercial photographers, videographers, motion designers, and brand strategists. Collaborate inside dedicated production workspaces with milestone escrow protection.
            </p>

            {/* Dual CTA Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Link href="/register?role=business" className="w-full sm:w-auto">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full sm:w-auto gap-2 px-7 text-sm font-semibold tracking-wide"
                >
                  <span>Hire Creative Talent</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/register?role=freelancer" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto gap-2 px-7 text-sm font-semibold"
                >
                  <span>Join as a Creator</span>
                </Button>
              </Link>
            </div>

            {/* Editorial Trust Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-y-2 gap-x-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Escrow-Protected Milestones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                <span>Zero Low-Ball Bidding</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-pink-500" />
                <span>Curated Portfolios Only</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Showcase Card */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              
              {/* Main Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xl transition-all duration-300 hover:border-foreground/20">
                <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 rounded-full bg-pastel-pink" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Active Campaign Brief
                    </span>
                  </div>
                  <Badge variant="pastel-green" size="sm">
                    Verified Brief
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        Global Autumn Brand Film & Packaging
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Client: Lumina Botanicals • Bangalore & Paris
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-secondary/50 p-3.5 border border-border/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Production Budget</span>
                      <span className="font-semibold text-foreground">₹4,20,000 INR</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Milestones Status</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        2 of 3 Escrow Funded
                      </span>
                    </div>
                  </div>

                  {/* Team Members In Workspace */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Assembled Creative Crew
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between rounded-lg bg-card border border-border p-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-pastel-blue-subtle text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs border border-pastel-blue-border">
                            AS
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Aarav Sharma</p>
                            <p className="text-[10px] text-muted-foreground">Cinematographer (RED Raptor)</p>
                          </div>
                        </div>
                        <Badge variant="pastel-blue" size="sm">Lead DP</Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-card border border-border p-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-pastel-pink-subtle text-pink-700 dark:text-pink-300 font-bold flex items-center justify-center text-xs border border-pastel-pink-border">
                            TS
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Tara Sen</p>
                            <p className="text-[10px] text-muted-foreground">Brand Identity & Packaging</p>
                          </div>
                        </div>
                        <Badge variant="pastel-pink" size="sm">Art Director</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      Razorpay Escrow Protected
                    </span>
                    <span className="font-mono">CRW-8821</span>
                  </div>
                </div>
              </div>

              {/* Accent Floating Pill */}
              <div className="hidden sm:flex absolute -bottom-4 -right-4 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 shadow-lg text-xs font-medium text-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>384 New Creative Inquiries Today</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
