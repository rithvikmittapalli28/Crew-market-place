import { requireAuthenticatedUser, requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, User, Flag, MessageSquare, History } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { TaskDetailClient } from "./task-client";

type Props = { params: Promise<{ projectId: string; taskId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { taskId } = await params;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
  return {
    title: task ? `${task.title} — Crewn` : "Task — Crewn",
  };
}

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

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-secondary text-muted-foreground",
  MEDIUM: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  HIGH: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  URGENT: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default async function TaskDetailPage({ params }: Props) {
  const { projectId, taskId } = await params;
  const user = await requireAuthenticatedUser();

  const access = await requireProjectMember(projectId);
  if (!access) redirect("/projects");

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
    include: {
      assignedTo: { select: { id: true, name: true, avatarUrl: true, email: true } },
      milestone: { select: { id: true, title: true } },
      comments: {
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      },
      dependencies: {
        include: { dependsOnTask: { select: { id: true, title: true, status: true } } },
      },
    },
  });

  if (!task) notFound();

  const isManager = access.isBusinessOverride || ["OWNER", "MANAGER"].includes(access.membership?.role ?? "");
  const isAssignee = task.assignedToId === user.id;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={task.title}
        subtitle={task.milestone ? `${task.milestone.title}` : "Task"}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Back */}
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Project
          </Button>
        </Link>

        {/* Task header */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TASK_STATUS_STYLES[task.status]}`}>
              {task.status.replace(/_/g, " ")}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}>
              <Flag className="h-3 w-3 inline mr-1" />
              {task.priority}
            </span>
          </div>

          <h1 className="text-lg font-bold text-foreground">{task.title}</h1>

          {task.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            {task.assignedTo && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Assignee
                </p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 border border-border">
                    {task.assignedTo.avatarUrl && <AvatarImage src={task.assignedTo.avatarUrl} />}
                    <AvatarFallback className="text-[10px] font-bold">
                      {(task.assignedTo.name || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground">{task.assignedTo.name}</span>
                </div>
              </div>
            )}
            {task.dueDate && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Due Date
                </p>
                <p className="text-xs font-medium text-foreground">
                  {new Date(task.dueDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            {task.milestone && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Milestone</p>
                <p className="text-xs font-medium text-foreground truncate">{task.milestone.title}</p>
              </div>
            )}
          </div>

          {/* Status transition client component */}
          {(isManager || isAssignee) && (
            <TaskDetailClient
              projectId={projectId}
              taskId={taskId}
              currentStatus={task.status}
              isManager={isManager}
              isAssignee={isAssignee}
              assignedToId={task.assignedToId}
              currentUserId={user.id}
            />
          )}
        </div>

        {/* Dependencies */}
        {task.dependencies.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dependencies ({task.dependencies.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {task.dependencies.map((dep) => (
                <div key={dep.id} className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Blocked by:</span>
                  <Link href={`/projects/${projectId}/tasks/${dep.dependsOnTask.id}`}>
                    <span className="font-medium text-foreground hover:underline">
                      {dep.dependsOnTask.title}
                    </span>
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      TASK_STATUS_STYLES[dep.dependsOnTask.status] ?? "bg-secondary text-foreground"
                    }`}
                  >
                    {dep.dependsOnTask.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Status History */}
        {task.statusHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Status History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.statusHistory.map((h) => (
                <div key={h.id} className="flex items-start gap-3">
                  <Avatar className="h-6 w-6 border border-border shrink-0 mt-0.5">
                    {h.changedBy.avatarUrl && <AvatarImage src={h.changedBy.avatarUrl} />}
                    <AvatarFallback className="text-[10px] font-bold">
                      {(h.changedBy.name || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">{h.changedBy.name}</span>
                      <span className="text-[11px] text-muted-foreground">changed status</span>
                      <Badge variant="secondary" size="sm" className="text-[10px]">{h.fromStatus}</Badge>
                      <span className="text-[11px] text-muted-foreground">→</span>
                      <Badge variant="pastel-blue" size="sm" className="text-[10px]">{h.toStatus}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(h.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Comments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments ({task.comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet. Be the first to comment.</p>
            ) : (
              task.comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-3">
                  <Avatar className="h-7 w-7 border border-border shrink-0">
                    {comment.author.avatarUrl && <AvatarImage src={comment.author.avatarUrl} />}
                    <AvatarFallback className="text-[10px] font-bold">
                      {(comment.author.name || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{comment.author.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))
            )}

            {/* Add comment form — client */}
            <AddCommentForm projectId={projectId} taskId={taskId} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function AddCommentForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  // This needs to be a client component for interactivity
  // We'll import it from the client file
  return (
    <TaskDetailClient
      projectId={projectId}
      taskId={taskId}
      currentStatus=""
      isManager={false}
      isAssignee={false}
      assignedToId={null}
      currentUserId=""
      commentOnly
    />
  );
}
