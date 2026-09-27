import { requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { notFound, redirect } from "next/navigation";
import {
  Users,
  Target,
  CheckSquare,
  FileText,
  ArrowLeft,
  CalendarDays,
  DollarSign,
  Clock,
  UserPlus,
  Activity,
  Building2,
  Sparkles,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { ProjectWorkspaceClient } from "./workspace-client";
import { MilestonePaymentActions } from "@/components/projects/milestone-payment-actions";

type Props = { params: Promise<{ projectId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });
  return {
    title: project ? `${project.title} — Crewn` : "Project — Crewn",
    description: "Project workspace with milestones, tasks, and deliverables.",
  };
}

const STATUS_STYLES: Record<string, { label: string; variant: "pastel-green" | "pastel-yellow" | "pastel-blue" | "warning" | "secondary" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  OPEN: { label: "Open", variant: "pastel-blue" },
  IN_PROGRESS: { label: "In Progress", variant: "pastel-yellow" },
  IN_REVIEW: { label: "In Review", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "pastel-green" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

const TASK_STATUS_STYLES: Record<string, string> = {
  TODO: "bg-secondary text-foreground",
  IN_PROGRESS: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  SUBMITTED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  IN_REVIEW: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  REVISION_REQUESTED: "bg-red-500/15 text-red-700 dark:text-red-400",
  APPROVED: "bg-green-500/15 text-green-700 dark:text-green-400",
  COMPLETED: "bg-green-500/15 text-green-700 dark:text-green-400",
  CANCELLED: "bg-muted text-muted-foreground",
};

const DELIVERABLE_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-secondary text-foreground",
  IN_PROGRESS: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  SUBMITTED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  REVISION_REQUESTED: "bg-red-500/15 text-red-700 dark:text-red-400",
  APPROVED: "bg-green-500/15 text-green-700 dark:text-green-400",
};

const MILESTONE_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-secondary text-foreground",
  ACTIVE: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  SUBMITTED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  APPROVED: "bg-green-500/15 text-green-700 dark:text-green-400",
  PAID: "bg-green-700/15 text-green-800 dark:text-green-300",
};

export default async function ProjectWorkspacePage({ params }: Props) {
  const { projectId } = await params;
  const access = await requireProjectMember(projectId);
  if (!access) {
    redirect("/projects");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      business: { select: { id: true, name: true, slug: true, logoUrl: true } },
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
              freelancerProfile: {
                select: {
                  id: true,
                  headline: true,
                },
              },
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              leadFreelancerId: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      milestones: {
        orderBy: { dueDate: "asc" },
        include: {
          freelancer: { select: { id: true, name: true, email: true } },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, amount: true, currency: true },
          },
          _count: { select: { tasks: true, deliverables: true } },
        },
      },
      tasks: {
        orderBy: [{ milestoneId: "asc" }, { orderIndex: "asc" }],
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              freelancerProfile: { select: { headline: true } },
            },
          },
          milestone: { select: { id: true, title: true } },
          _count: { select: { comments: true } },
        },
        take: 50,
      },
      deliverables: {
        include: {
          milestone: { select: { id: true, title: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { members: true, tasks: true, milestones: true } },
    },
  });

  if (!project) notFound();

  const isBusinessMember = access.isBusinessOverride || access.user.role === "BUSINESS";
  const isFreelancer = access.user.role === "FREELANCER";
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.DRAFT;
  const totalBudget = project.budgetMax
    ? `${project.currency} ${Number(project.budgetMax).toLocaleString("en-IN")}`
    : project.budgetMin
    ? `From ${project.currency} ${Number(project.budgetMin).toLocaleString("en-IN")}`
    : null;

  // Task count per member
  const memberTaskCounts = new Map<string, number>();
  for (const t of project.tasks) {
    if (t.assignedTo?.id) {
      memberTaskCounts.set(t.assignedTo.id, (memberTaskCounts.get(t.assignedTo.id) || 0) + 1);
    }
  }

  // Segment members by collaboration role
  const businessLeaders = project.members.filter(
    (m) => m.role === "OWNER" || m.user.role === "BUSINESS"
  );
  const teamMembers = project.members.filter(
    (m) => m.teamId && m.role !== "OWNER" && m.user.role !== "BUSINESS"
  );
  const soloFreelancers = project.members.filter(
    (m) => !m.teamId && m.role !== "OWNER" && m.user.role !== "BUSINESS"
  );

  const memberOptions = project.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name || m.user.email,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    headline: m.user.freelancerProfile?.headline,
    teamName: m.team?.name,
  }));

  const milestoneOptions = project.milestones.map((ms) => ({
    id: ms.id,
    title: ms.title,
  }));

  // Activity log
  const activityLogs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entityId: projectId },
        { metadataJson: { contains: projectId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={project.title}
        subtitle={`${project.business.name} • ${statusStyle.label}`}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Back + status bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Projects
            </Button>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusStyle.variant} size="sm">
              {statusStyle.label}
            </Badge>
            {totalBudget && (
              <Badge variant="outline" size="sm" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {totalBudget}
              </Badge>
            )}
            {project.deadline && (
              <Badge variant="outline" size="sm" className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Due {new Date(project.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </Badge>
            )}
            <Link href={`/messages?project=${project.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>Team Channel</span>
              </Button>
            </Link>
            <ProjectWorkspaceClient
              projectId={project.id}
              currentStatus={project.status}
              isBusinessMember={isBusinessMember}
              members={memberOptions}
              milestones={milestoneOptions}
            />
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-foreground leading-relaxed">{project.description}</p>
          </div>
        )}

        {/* 3-column grid: Members | Milestones | Deliverables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Members Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Project Crew ({project.members.length})
                </CardTitle>
                {isBusinessMember && (
                  <InviteMemberButton projectId={project.id} />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">No crew members yet.</p>
              ) : (
                <>
                  {/* 1. Business Leadership */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-primary" />
                      Client & Business Leads
                    </p>
                    {businessLeaders.map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-secondary/20 p-2">
                          <Avatar className="h-7 w-7 border border-border shrink-0">
                            {m.user.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={m.user.name || ""} />}
                            <AvatarFallback className="text-[10px] font-bold">
                              {(m.user.name || m.user.email)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{m.user.name || m.user.email}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{project.business.name}</p>
                          </div>
                          <Badge variant="outline" size="sm" className="text-[9px] shrink-0 border-primary/30 text-primary">
                            {m.role === "OWNER" ? "Project Lead" : m.role}
                          </Badge>
                        </div>
                      ))}
                  </div>

                  {/* 2. Creative Teams */}
                  {teamMembers.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3 text-indigo-500" />
                        Creative Team ({teamMembers[0].team?.name || "Team"})
                      </p>
                      {teamMembers.map((m) => {
                        const taskCount = memberTaskCounts.get(m.user.id) || 0;
                        const isLead = m.team?.leadFreelancerId === m.user.id;
                        return (
                          <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-indigo-500/5 p-2">
                            <Avatar className="h-7 w-7 border border-border shrink-0">
                              {m.user.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={m.user.name || ""} />}
                              <AvatarFallback className="text-[10px] font-bold">
                                {(m.user.name || m.user.email)[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                                {m.user.name || m.user.email}
                                {isLead && (
                                  <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded">
                                    Lead
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {m.user.freelancerProfile?.headline || "Creative Specialist"}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="secondary" size="sm" className="text-[9px]">
                                {taskCount} {taskCount === 1 ? "task" : "tasks"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Solo Specialists */}
                  {soloFreelancers.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-emerald-500" />
                        Independent Specialists
                      </p>
                      {soloFreelancers.map((m) => {
                        const taskCount = memberTaskCounts.get(m.user.id) || 0;
                        return (
                          <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-emerald-500/5 p-2">
                            <Avatar className="h-7 w-7 border border-border shrink-0">
                              {m.user.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={m.user.name || ""} />}
                              <AvatarFallback className="text-[10px] font-bold">
                                {(m.user.name || m.user.email)[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground truncate">{m.user.name || m.user.email}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {m.user.freelancerProfile?.headline || "Specialist"}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="secondary" size="sm" className="text-[9px]">
                                {taskCount} {taskCount === 1 ? "task" : "tasks"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Milestones */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Milestones ({project.milestones.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.milestones.length === 0 ? (
                <EmptyState
                  icon={<Target className="h-5 w-5 text-muted-foreground" />}
                  title="No milestones"
                  description="Add milestones to track payment stages and project checkpoints."
                />
              ) : (
                project.milestones.map((ms) => (
                  <div key={ms.id} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{ms.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          MILESTONE_STATUS_STYLES[ms.status] ?? "bg-secondary text-foreground"
                        }`}
                      >
                        {ms.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{ms._count.tasks} tasks</span>
                      <span>{ms._count.deliverables} deliverables</span>
                      {ms.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ms.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <MilestonePaymentActions
                      milestoneId={ms.id}
                      milestoneTitle={ms.title}
                      amount={Number(ms.amount)}
                      currency={project.currency}
                      milestoneStatus={ms.status}
                      paymentStatus={ms.payments[0]?.status || null}
                      isBusinessMember={isBusinessMember}
                      isFreelancer={isFreelancer}
                      assignedFreelancerName={ms.freelancer?.name || null}
                      currentUserEmail={access.user.email}
                      currentUserName={access.user.name || ""}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Deliverables */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Deliverables ({project.deliverables.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.deliverables.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-5 w-5 text-muted-foreground" />}
                  title="No deliverables"
                  description="Define deliverables that creators will submit for review."
                />
              ) : (
                project.deliverables.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{d.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          DELIVERABLE_STATUS_STYLES[d.status] ?? "bg-secondary text-foreground"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>v{d.currentVersionNumber}</span>
                      <span>{d._count.versions} submissions</span>
                      {d.milestone && <span className="truncate">{d.milestone.title}</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks board */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              Tasks ({project._count.tasks})
            </h3>
          </div>

          {project.tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  icon={<CheckSquare className="h-6 w-6 text-muted-foreground" />}
                  title="No tasks yet"
                  description="Add tasks to break down the project into actionable items that can be assigned to team members."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {project.tasks.map((task) => (
                <Link key={task.id} href={`/projects/${project.id}/tasks/${task.id}`}>
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-foreground/20 hover:bg-secondary/20 transition-all duration-150 cursor-pointer group">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            TASK_STATUS_STYLES[task.status] ?? "bg-secondary text-foreground"
                          }`}
                        >
                          {task.status.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            task.priority === "URGENT"
                              ? "bg-red-500/15 text-red-700 dark:text-red-400"
                              : task.priority === "HIGH"
                              ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {task.milestone && <span className="truncate">📍 {task.milestone.title}</span>}
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {task._count.comments > 0 && (
                          <span>{task._count.comments} comments</span>
                        )}
                      </div>
                    </div>

                    {task.assignedTo && (
                      <div className="flex items-center gap-2 shrink-0 bg-secondary/30 rounded-lg px-2.5 py-1 border border-border/40">
                        <Avatar className="h-6 w-6 border border-border shrink-0">
                          {task.assignedTo.avatarUrl && (
                            <AvatarImage src={task.assignedTo.avatarUrl} alt={task.assignedTo.name || ""} />
                          )}
                          <AvatarFallback className="text-[9px] font-bold">
                            {(task.assignedTo.name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold text-foreground leading-tight truncate max-w-[120px]">
                            {task.assignedTo.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground leading-tight truncate max-w-[120px]">
                            {task.assignedTo.freelancerProfile?.headline || "Specialist"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        {activityLogs.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </h3>
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                >
                  {log.actor && (
                    <Avatar className="h-6 w-6 border border-border shrink-0 mt-0.5">
                      {log.actor.avatarUrl && <AvatarImage src={log.actor.avatarUrl} />}
                      <AvatarFallback className="text-[10px] font-bold">
                        {(log.actor.name || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{log.actor?.name ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">
                        {log.action.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InviteMemberButton({ projectId }: { projectId: string }) {
  return (
    <Link href={`/projects/${projectId}?invite=true`}>
      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
        <UserPlus className="h-3 w-3" />
        Invite
      </Button>
    </Link>
  );
}
