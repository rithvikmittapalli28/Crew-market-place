import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card/40 pt-16 pb-12 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-foreground text-background font-black text-xs">
                C
              </span>
              <span className="font-extrabold text-lg">
                crewn<span className="text-pastel-pink font-serif">.</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
              The collaborative marketplace connecting visionary brands with elite creative talent. Designed for seamless briefs, escrow milestones, and high-caliber production.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>Production Infrastructure • Active</span>
            </div>
          </div>

          {/* Creative Disciplines */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Creative Disciplines
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#talent-categories" className="hover:text-foreground transition-colors">
                  Videography & Film
                </Link>
              </li>
              <li>
                <Link href="#talent-categories" className="hover:text-foreground transition-colors">
                  Commercial Photography
                </Link>
              </li>
              <li>
                <Link href="#talent-categories" className="hover:text-foreground transition-colors">
                  Video Editing & Color
                </Link>
              </li>
              <li>
                <Link href="#talent-categories" className="hover:text-foreground transition-colors">
                  Motion & 3D CGI
                </Link>
              </li>
              <li>
                <Link href="#talent-categories" className="hover:text-foreground transition-colors">
                  Brand Identity Design
                </Link>
              </li>
              <li>
                <Link href="#talent-categories" className="hover:text-foreground transition-colors">
                  Editorial & Copywriting
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform Workspaces */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Platform
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#how-it-works" className="hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="#workspace-preview" className="hover:text-foreground transition-colors">
                  Shared Workspaces
                </Link>
              </li>
              <li>
                <Link href="/business" className="hover:text-foreground transition-colors flex items-center gap-1">
                  For Businesses
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link href="/freelancer" className="hover:text-foreground transition-colors flex items-center gap-1">
                  For Freelancers
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-foreground transition-colors">
                  Talent Directory
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Trust & Standards
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors">
                  Escrow Protection
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors">
                  Vetting Criteria
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors">
                  Terms of Service
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors">
                  Creator Code of Conduct
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row gap-4">
          <p>© {new Date().getFullYear()} Crewn Technologies Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Built for high-caliber creative commerce</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-foreground font-mono">v1.0.0-foundation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
