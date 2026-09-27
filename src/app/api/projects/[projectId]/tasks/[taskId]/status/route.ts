import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { isValidTaskTransition } from "@/lib/projects/validate-status-transition";
import type { TaskStatus } from "@/types";
import { TaskStatus as PrismaTaskStatus } from "@prisma/client";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/tasks/[taskId]/status
// Records TaskStatusHistory. Assignee can advance; OWNER/MANAGER can do any.
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const body = await req.json();
    const { status: toStatus } = body;

    if (!toStatus || typeof toStatus !== "string") {
      return NextResponse.json({ error: "status field is required" }, { status: 400 });
    }

    const from = task.status as TaskStatus;
    const to = toStatus as TaskStatus;

    if (!isValidTaskTransition(from, to)) {
      return NextResponse.json(
        { error: `Cannot transition task from ${from} to ${to}` },
        { status: 422 }
      );
    }

    // Verify task dependencies: blocking tasks must be COMPLETED or APPROVED
    if (["IN_PROGRESS", "SUBMITTED", "APPROVED", "COMPLETED"].includes(to)) {
      const dependencies = await prisma.taskDependency.findMany({
        where: { taskId },
        include: {
          dependsOnTask: { select: { id: true, title: true, status: true } },
        },
      });

      const unresolved = dependencies.filter(
        (dep) => dep.dependsOnTask.status !== "COMPLETED" && dep.dependsOnTask.status !== "APPROVED"
      );

      if (unresolved.length > 0) {
        const blockingTitles = unresolved.map((u) => `"${u.dependsOnTask.title}" (${u.dependsOnTask.status})`).join(", ");
        return NextResponse.json(
          { error: `Cannot transition task: blocking prerequisite tasks are not finished: ${blockingTitles}` },
          { status: 422 }
        );
      }
    }

    const isManager =
      access.isBusinessOverride ||
      access.membership?.role === "OWNER" ||
      access.membership?.role === "MANAGER";
    const isAssignee = task.assignedToId === access.user.id;

    if (!isManager && !isAssignee) {
      return NextResponse.json({ error: "Forbidden: only the assignee or a manager may update this task" }, { status: 403 });
    }

    // Use a transaction to update task status and record history atomically
    const [updatedTask] = await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: { status: to as PrismaTaskStatus },
      }),
      prisma.taskStatusHistory.create({
        data: {
          taskId,
          changedById: access.user.id,
          fromStatus: from as PrismaTaskStatus,
          toStatus: to as PrismaTaskStatus,
        },
      }),
    ]);

    logProjectActivity({
      projectId,
      entityType: "TASK",
      entityId: taskId,
      action: "TASK_STATUS_CHANGED",
      actorId: access.user.id,
      metadata: { from, to, taskTitle: task.title },
    }).catch(console.error);

    return NextResponse.json({ success: true, status: updatedTask.status });
  } catch (error) {
    console.error("Task status transition error:", error);
    return NextResponse.json({ error: "Failed to update task status" }, { status: 500 });
  }
}
