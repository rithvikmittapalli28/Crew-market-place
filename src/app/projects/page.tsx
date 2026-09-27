import { requireAuthenticatedUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Briefcase,
  Plus,
  Calendar,
  Users,
  Target,
  CheckSquare,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — Crewn",
  description: "Manage your campaign projects, assign creators, track milestones and deliverables.",
};

const STATUS_STYLES: Record<string, { label: string; variant: "pastel-green" | "pastel-yellow" | "pastel-blue" | "warning" | "secondary" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  OPEN: { label: "Open", variant: "pastel-blue" },
  IN_PROGRESS: { label: "In Progress", variant: "pastel-yellow" },
  IN_REVIEW: { label: "In Review", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "pastel-green" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

export default async function ProjectsPage() {
  const user = await requireAuthenticatedUser();

  let projects: Awaited<ReturnType<typeof fetchProjects>> = [];
  projects = await fetchProjects(user.id, user.role, (user.businessMemberships ?? []).map((m) => m.businessId));

  const active = projects.filter((p) => ["OPEN", "IN_PROGRESS"].includes(p.status));
  const inReview = projects.filter((p) => p.status === "IN_REVIEW");
  const completed = projects.filter((p) => p.status === "COMPLETED");
  const draft = projects.filter((p) => p.status === "DRAFT");

  const isBusinessUser = user.role === "BUSINESS";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Projects"
        subtitle="Campaign workspaces with milestone lifecycles, creator rosters, and versioned deliverables"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-foreground">
              {projects.length} {projects.length === 1 ? "Project" : "Projects"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isBusinessUser
                ? "Campaign briefs for your business organization"
                : "Projects you have been invited to collaborate on"}
            </p>
          </div>
          {isBusinessUser && (
            <Link href="/projects/new">
              <Button variant="default" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>New Project</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Stats row */}
        {projects.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Active", count: active.length, icon: Target, color: "text-primary" },
              { label: "In Review", count: inReview.length, icon: Clock, color: "text-yellow-500" },
              { label: "Completed", count: completed.length, icon: CheckSquare, color: "text-green-500" },
              { label: "Draft", count: draft.length, icon: Briefcase, color: "text-muted-foreground" },
            ].map(({ label, count, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color} shrink-0`} />
                <div>
                  <p className="text-xl font-mono font-bold text-foreground">{count}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Projects list */}
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={<Briefcase className="h-8 w-8 text-muted-foreground" />}
                title={isBusinessUser ? "No projects yet" : "No active collaborations"}
                description={
                  isBusinessUser
                    ? "Create your first campaign brief. Invite creators, define milestones, assign tasks, and track deliverables — all in one workspace."
                    : "When a business invites you to collaborate on a project, it will appear here."
                }
                action={
                  isBusinessUser ? (
                    <Link href="/projects/new">
                      <Button variant="default" size="sm">
                        Create Campaign Brief
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.DRAFT;
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="p-5 border border-border bg-card hover:border-foreground/20 hover:bg-secondary/30 transition-all duration-150 cursor-pointer group">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {project.title}
                          </h3>
                          <Badge variant={statusStyle.variant} size="sm">
                            {statusStyle.label}
                          </Badge>
                        </div>

                        {project.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {project.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project._count.members} {project._count.members === 1 ? "member" : "members"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {project._count.milestones} {project._count.milestones === 1 ? "milestone" : "milestones"}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            {project._count.tasks} {project._count.tasks === 1 ? "task" : "tasks"}
                          </span>
                          {project.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due {new Date(project.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: business + arrow */}
                      <div className="flex items-center gap-3 shrink-0">
                        {project.business && (
                          <span className="text-[11px] text-muted-foreground hidden sm:block">
                            {project.business.name}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

async function fetchProjects(userId: string, role: string, businessIds: string[]) {
  if (role === "BUSINESS") {
    return prisma.project.findMany({
      where: { businessId: { in: businessIds } },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        _count: { select: { members: true, milestones: true, tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      business: { select: { id: true, name: true, slug: true } },
      _count: { select: { members: true, milestones: true, tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}
