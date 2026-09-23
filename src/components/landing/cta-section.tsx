import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Sparkles, Building2 } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          
          {/* Business CTA Box */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10 shadow-lg transition-all hover:border-foreground/20">
            <div className="space-y-4">
              <Badge variant="pastel-pink" size="md">
                <Building2 className="h-3 w-3 mr-1" />
                For Visionary Brands
              </Badge>

              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Hire vetted creative specialists for your next campaign<span className="text-pastel-pink font-serif">.</span>
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Post your production brief, review curated reels within hours, and collaborate in dedicated workspaces with milestone escrow security.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link href="/register?role=business" className="w-full sm:w-auto">
                <Button variant="default" size="lg" className="w-full gap-2">
                  <span>Post a Creative Brief</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/marketplace" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full">
                  Browse Talent
                </Button>
              </Link>
            </div>
          </div>

          {/* Freelancer CTA Box */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10 shadow-lg transition-all hover:border-foreground/20">
            <div className="space-y-4">
              <Badge variant="pastel-green" size="md">
                <Sparkles className="h-3 w-3 mr-1" />
                For Elite Creators
              </Badge>

              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Showcase your portfolio to high-value commercial clients<span className="text-pastel-green font-serif">.</span>
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Skip low-ball bidding platforms. Get discovered directly by premier brands, set your own rates, and receive guaranteed on-time milestone payouts.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link href="/register?role=freelancer" className="w-full sm:w-auto">
                <Button variant="default" size="lg" className="w-full gap-2">
                  <span>Apply as a Creator</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/freelancer" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full">
                  Creator Benefits
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
