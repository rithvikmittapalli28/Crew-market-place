import { requireFreelancer } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, ExternalLink, Globe } from "lucide-react";
import Link from "next/link";

export default async function FreelancerDashboardPage() {
  const user = await requireFreelancer();

  const profile = await prisma.freelancerProfile.findUnique({
    where: { id: user.freelancerProfileId },
    include: {
      availability: true,
      services: true,
      skills: {
        include: { skill: true },
      },
      portfolioItems: true,
    },
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <EmptyState
          title="Profile not found"
          description="Your creator studio profile could not be loaded."
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

  const availability = profile.availability;
  const services = profile.services;
  const skills = profile.skills.map((ps) => ps.skill.name);
  const portfolioItems = profile.portfolioItems;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={`${user.name || "Creator Studio"} — Workspace`}
        subtitle="Manage your editorial portfolio, service packages, availability, freelancer teams, and milestone earnings"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Creator Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between rounded-2xl border border-border bg-card p-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background font-black text-xl uppercase">
              {(user.name || user.email)[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">{user.name}</h1>
                <Badge variant="pastel-yellow" size="sm">
                  {profile.yearsExperience} yrs exp
                </Badge>
                {profile.isVerified && (
                  <Badge variant="pastel-green" size="sm">
                    Verified Creator
                  </Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground mt-0.5">{profile.headline}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile.location || "Remote Studio"}
                {profile.hourlyRate && ` • ₹${Number(profile.hourlyRate).toLocaleString()}/hr`}
                {profile.website && (
                  <>
                    {" "}•{" "}
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline text-foreground"
                    >
                      <Globe className="h-3 w-3" />
                      <span>{profile.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="text-xs">
                Edit Studio Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* Availability & Capacity Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-green-subtle text-emerald-700 dark:text-emerald-300 border border-pastel-green-border">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Availability Status</p>
                <p className="text-[11px] text-muted-foreground">
                  {availability?.hoursPerWeek || 40} hrs / week capacity
                </p>
              </div>
            </div>
            <Badge
              variant={
                availability?.status === "AVAILABLE"
                  ? "pastel-green"
                  : availability?.status === "BUSY"
                  ? "warning"
                  : "secondary"
              }
              size="sm"
            >
              {availability?.status.replace("_", " ") || "AVAILABLE"}
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pastel-blue-subtle text-blue-700 dark:text-blue-300 border border-pastel-blue-border">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Freelancer Collectives</p>
                <p className="text-[11px] text-muted-foreground">Assemble or join creative teams</p>
              </div>
            </div>
            <Badge variant="outline" size="sm">
              Team Invites Active
            </Badge>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Profile Status</CardDescription>
              <CardTitle className="text-lg">Live & Discoverable</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-green" size="sm">
                Marketplace Ready
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Total Earnings (YTD)</CardDescription>
              <CardTitle className="text-2xl font-mono">₹0</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-yellow" size="sm">
                Direct Escrow Ready
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Active Service Packages</CardDescription>
              <CardTitle className="text-2xl font-mono">{services.length} Packages</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-blue" size="sm">
                Contract Scope Defined
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Portfolio Showcase</CardDescription>
              <CardTitle className="text-2xl font-mono">{portfolioItems.length} Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" size="sm">
                High-Res Ready
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Bio & Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Creative Bio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </CardContent>
            </Card>

            {/* Service Packages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Commissionable Services</CardTitle>
                <CardDescription className="text-xs">
                  Packaged deliverables that clients can directly fund into milestone escrow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border bg-card p-4 gap-3"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{srv.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{srv.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        ⏱ {srv.deliveryDays} Days Delivery • {srv.revisionLimit} Revisions Included
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono text-foreground">
                        ₹{Number(srv.basePrice).toLocaleString()}
                      </p>
                      <Badge variant="secondary" size="sm" className="mt-1">
                        Direct Escrow
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* Skills Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Creative Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary" size="sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Portfolio Items Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Showcase Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {portfolioItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                      <Badge variant="outline" size="sm">
                        {item.mediaType}
                      </Badge>
                    </div>
                    {item.externalUrl && (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>View Reel / Project</span>
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
