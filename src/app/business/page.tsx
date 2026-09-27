import { requireBusinessOwner } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  Globe,
  Bookmark,
  Mail,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default async function BusinessDashboardPage() {
  const user = await requireBusinessOwner();

  const [business, savedCreators, sentInquiries] = await Promise.all([
    prisma.business.findUnique({
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
    }),
    prisma.savedCreator.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        freelancer: {
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
            skills: {
              take: 3,
              include: { skill: true },
            },
          },
        },
      },
    }),
    prisma.creatorInquiry.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        freelancer: {
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        service: {
          select: {
            title: true,
            basePrice: true,
          },
        },
      },
    }),
  ]);

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
        subtitle="Manage saved creator rosters, direct inquiries, organization members, and campaign briefs"
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
            <Link href="/marketplace">
              <Button variant="default" size="sm" className="gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Discover Creators</span>
              </Button>
            </Link>
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
              <CardDescription className="text-xs">Saved Creators</CardDescription>
              <CardTitle className="text-2xl font-mono">{savedCreators.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-blue" size="sm">
                Roster Bookmarks
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Active Inquiries</CardDescription>
              <CardTitle className="text-2xl font-mono">{sentInquiries.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-yellow" size="sm">
                Project Discussions
              </Badge>
            </CardContent>
          </Card>

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
              <CardDescription className="text-xs">Team Members</CardDescription>
              <CardTitle className="text-2xl font-mono">{memberCount} Seats</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-green" size="sm">
                Active Organization
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Saved Creators Roster */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                Saved Talent Roster
              </h2>
              <p className="text-xs text-muted-foreground">
                Bookmarked creative directors, cinematographers, and specialists for upcoming campaigns.
              </p>
            </div>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Browse Marketplace
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {savedCreators.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  icon={<Bookmark className="h-6 w-6 text-muted-foreground" />}
                  title="No saved creators yet"
                  description="Explore our verified creator directory to bookmark standout talent and build your commercial roster."
                  action={
                    <Link href="/marketplace">
                      <Button variant="default" size="sm">
                        Explore Talent Directory
                      </Button>
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedCreators.map((item) => {
                const freelancer = item.freelancer;
                const slugOrId = freelancer.publicSlug || freelancer.id;
                return (
                  <Card key={item.id} className="p-5 border border-border bg-card flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          {freelancer.user.avatarUrl && (
                            <AvatarImage src={freelancer.user.avatarUrl} alt={freelancer.user.name || "Creator"} />
                          )}
                          <AvatarFallback className="text-xs font-bold">
                            {(freelancer.user.name || "CR")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-xs text-foreground truncate">
                            {freelancer.user.name}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {freelancer.headline}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {freelancer.skills.map((s) => (
                          <Badge key={s.skill.name} variant="secondary" size="sm" className="text-[10px]">
                            {s.skill.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {freelancer.hourlyRate ? `₹${Number(freelancer.hourlyRate).toLocaleString()}/hr` : "Inquire"}
                      </span>
                      <Link href={`/creators/${slugOrId}`}>
                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                          View Profile
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Project Inquiries Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Creator Inquiries
            </h2>
            <p className="text-xs text-muted-foreground">
              Direct briefs and scope inquiries initiated with creative talent.
            </p>
          </div>

          {sentInquiries.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  icon={<Mail className="h-6 w-6 text-muted-foreground" />}
                  title="No active inquiries"
                  description="When you reach out to creators through their profile or service packages, status updates will appear here."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sentInquiries.map((inq) => (
                <Card key={inq.id} className="p-4 border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-xs text-foreground">
                        To: {inq.freelancer.user.name}
                      </h4>
                      {inq.service && (
                        <Badge variant="outline" size="sm" className="text-[10px]">
                          Package: {inq.service.title} (₹{Number(inq.service.basePrice).toLocaleString()})
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      &ldquo;{inq.message}&rdquo;
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Sent {new Date(inq.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={
                        inq.status === "ACCEPTED"
                          ? "pastel-green"
                          : inq.status === "PENDING"
                          ? "pastel-yellow"
                          : inq.status === "DECLINED"
                          ? "warning"
                          : "secondary"
                      }
                      size="sm"
                    >
                      {inq.status}
                    </Badge>
                    <Link href={`/creators/${inq.freelancer.publicSlug || inq.freelancer.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        Profile
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Organization Members Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Organization Members</h2>
            <p className="text-xs text-muted-foreground">
              Colleagues with collaborative access to campaign briefs and milestone releases.
            </p>
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
      </main>
    </div>
  );
}
