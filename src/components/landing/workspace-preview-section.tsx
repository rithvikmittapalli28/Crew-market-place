import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileCheck, Layers, Users, Shield } from "lucide-react";

export function WorkspacePreviewSection() {
  return (
    <section id="workspace-preview" className="border-t border-border bg-card/40 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-pastel-blue" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Collaborative Infrastructure
            </p>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            A dedicated workspace for every campaign<span className="text-pastel-blue font-serif">.</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Move beyond chaotic email threads and fragmented cloud folders. Track production milestones, review 4K assets, and manage deliverables with zero ambiguity.
          </p>
        </div>

        {/* Workspace Mockup Card */}
        <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          
          {/* Top Workspace Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-border bg-secondary/30 px-6 py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background font-bold text-xs">
                KB
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Kinetic Brand Identity & 3D Hardware Teaser
                </h3>
                <p className="text-xs text-muted-foreground">
                  Client: Aether Innovations • Workspace ID: #CRW-9042
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="pastel-green" size="md">
                Phase 2: Active Production
              </Badge>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span>₹3,80,000 Escrow Locked</span>
              </div>
            </div>
          </div>

          {/* Workspace Body Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
            
            {/* Left Column: Milestones & Deliverables Roadmap */}
            <div className="lg:col-span-8 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Milestone Roadmap
                  </h4>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  2 of 4 Approved
                </span>
              </div>

              {/* Milestones List */}
              <div className="space-y-3">
                {/* Milestone 1 */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Milestone 1: Creative Direction & Moodboards
                      </p>
                      <p className="text-muted-foreground">
                        Approved on 14 Sept • Deliverables accepted
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">₹80,000</span>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Escrow Released
                    </p>
                  </div>
                </div>

                {/* Milestone 2 */}
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Milestone 2: 3D Asset Geometry & Texture Passes
                      </p>
                      <p className="text-muted-foreground">
                        Approved on 19 Sept • 3 revisions closed
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">₹1,20,000</span>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Escrow Released
                    </p>
                  </div>
                </div>

                {/* Milestone 3 - Currently In Review */}
                <div className="flex items-center justify-between rounded-xl border border-pastel-yellow-border bg-pastel-yellow-subtle p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0 animate-pulse" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Milestone 3: 4K Master Render & Sound Design
                      </p>
                      <p className="text-muted-foreground">
                        Submitted 2 hours ago • Ready for client review
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">₹1,10,000</span>
                    <Badge variant="pastel-yellow" size="sm" className="mt-1">
                      In Review
                    </Badge>
                  </div>
                </div>

                {/* Milestone 4 - Pending */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4 text-xs opacity-75">
                  <div className="flex items-start gap-3">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Milestone 4: Social Aspect Ratio Cuts & Project Raw Files
                      </p>
                      <p className="text-muted-foreground">
                        Due 28 Sept • Unlocks upon Milestone 3 approval
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-foreground">₹70,000</span>
                    <p className="text-[10px] text-muted-foreground">Funded in Escrow</p>
                  </div>
                </div>
              </div>

              {/* Deliverable Review Strip */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-blue-500" />
                    Latest Submission: Teaser_Cut_4K_v3.mov (1.8 GB)
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">ProRes 4444</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                    Approve & Release ₹1,10,000
                  </span>
                  <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    Request Timestamped Change
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Creative Team & Brief Metadata */}
            <div className="lg:col-span-4 p-6 space-y-6 bg-card/60">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Creative Crew
                  </h4>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-pastel-green-subtle text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs border border-pastel-green-border">
                        VR
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Vikramaditya Rao</p>
                        <p className="text-[10px] text-muted-foreground">3D & Houdini Lead</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-500 font-medium">Active now</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-pastel-pink-subtle text-pink-800 dark:text-pink-300 font-bold flex items-center justify-center text-xs border border-pastel-pink-border">
                        TS
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Tara Sen</p>
                        <p className="text-[10px] text-muted-foreground">Art Direction</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">1h ago</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3 text-xs">
                <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspace Guarantees
                </h5>
                <ul className="space-y-1.5 text-muted-foreground text-[11px]">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>Razorpay Instant Escrow Settlement</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>IP Rights Transfer Upon Final Payment</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>Lossless Cloud Asset Delivery</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
