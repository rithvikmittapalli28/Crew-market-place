import { requireBusinessOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Building2, Globe } from "lucide-react";
import Link from "next/link";

export default async function BusinessDashboardPage() {
  const user = await requireBusinessOwner();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
      projects: true,
    },
  });

  if (!business) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <EmptyState
          title="Organization not found"
          description="Your business organization profile could not be loaded."
          action={
            <Link href="/">
              <Button variant="default" size="sm">
                Return Home
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const memberCount = business.members.length;
  const projectCount = business.projects.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={`${business.name} — Workspace`}
        subtitle="Manage organization members, campaign briefs, multi-creator contracts, and escrow milestones"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Organization Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-border bg-card p-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground font-black text-sm">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">{business.name}</h2>
                <Badge variant="pastel-yellow" size="sm">
                  Owner: {user.name || user.email}
                </Badge>
                {business.isVerified && (
                  <Badge variant="pastel-green" size="sm">
                    Verified Brand
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {business.industry || "Creative Industry"} • {business.companySize || "1-10"} team members
                {business.website && (
                  <>
                    {" "}•{" "}
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline text-foreground"
                    >
                      <Globe className="h-3 w-3" />
                      <span>{business.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <span>Manage Organization</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Active Projects</CardDescription>
              <CardTitle className="text-2xl font-mono">{projectCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" size="sm">
                {projectCount === 0 ? "Ready for first brief" : "In production"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Organization Team Seats</CardDescription>
              <CardTitle className="text-2xl font-mono">{memberCount} / 5</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-blue" size="sm">
                Owner Seat Active
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Escrow In Hold</CardDescription>
              <CardTitle className="text-2xl font-mono">₹0</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-green" size="sm">
                Milestone Accounting Ready
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Deliverables In Review</CardDescription>
              <CardTitle className="text-2xl font-mono">0</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" size="sm">
                No pending reviews
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Active Members Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Organization Members</h2>
              <p className="text-xs text-muted-foreground">
                Colleagues with collaborative access to campaign briefs and milestone releases.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {business.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background font-bold text-xs uppercase">
                    {(member.user.name || member.user.email)[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{member.user.name || "Team Member"}</p>
                    <p className="text-[11px] text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                <Badge variant={member.role === "OWNER" ? "pastel-pink" : "secondary"} size="sm">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Briefs Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Campaign Briefs & Workspaces</h2>
            <p className="text-xs text-muted-foreground">
              Production projects configured with structured milestones, task dependencies, and escrow.
            </p>
          </div>

          {projectCount === 0 ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState
                  icon={<Briefcase className="h-6 w-6" />}
                  title="No active campaign briefs yet"
                  description="When you create production briefs in Phase 3, you can assemble multi-creator teams, fund escrow milestones, and review submitted 4K deliverables."
                  action={
                    <Link href="/marketplace">
                      <Button variant="default" size="sm">
                        Explore Creator Marketplace
                      </Button>
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {business.projects.map((proj) => (
                <Card key={proj.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{proj.title}</CardTitle>
                    <CardDescription className="text-xs">{proj.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
