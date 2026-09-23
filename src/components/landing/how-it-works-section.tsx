"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  HOW_IT_WORKS_BUSINESS,
  HOW_IT_WORKS_FREELANCER,
} from "@/lib/mock-data/landing-data";
import { Building2, Sparkles } from "lucide-react";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-border bg-card/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-pastel-yellow" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Production Workflow
            </p>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            How collaboration thrives on Crewn<span className="text-pastel-yellow font-serif">.</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A frictionless, transparent operating system designed specifically for high-touch creative productions.
          </p>
        </div>

        {/* Dual Track Tabs */}
        <Tabs defaultValue="business" className="w-full">
          <div className="flex justify-center mb-10">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="business" className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" />
                <span>For Businesses</span>
              </TabsTrigger>
              <TabsTrigger value="freelancer" className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                <span>For Creators</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Business Track */}
          <TabsContent value="business">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {HOW_IT_WORKS_BUSINESS.map((step) => (
                <div
                  key={step.step}
                  className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-foreground/20 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-2xl font-black text-foreground/30">
                        {step.step}
                      </span>
                      <Badge variant="pastel-yellow" size="sm">
                        {step.deliverableBadge}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                    Step {step.step} • Verified Workflow
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Creator Track */}
          <TabsContent value="freelancer">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {HOW_IT_WORKS_FREELANCER.map((step) => (
                <div
                  key={step.step}
                  className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-foreground/20 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-2xl font-black text-foreground/30">
                        {step.step}
                      </span>
                      <Badge variant="pastel-green" size="sm">
                        {step.deliverableBadge}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                    Step {step.step} • Creator First
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </section>
  );
}
