import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { TaskPriority } from "@prisma/client";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/tasks/[taskId]
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true, email: true } },
        milestone: { select: { id: true, title: true, status: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        attachments: {
          include: {
            file: { select: { id: true, fileName: true, mimeType: true, fileSize: true, storageKey: true } },
          },
        },
        statusHistory: {
          include: {
            changedBy: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        dependencies: {
          include: {
            dependsOnTask: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Get task error:", error);
    return NextResponse.json({ error: "Failed to get task" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/tasks/[taskId] — edit task fields
// Business OWNER/MANAGER or ProjectMember MANAGER; assignee can edit description only
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isManager =
      access.isBusinessOverride ||
      access.membership?.role === "OWNER" ||
      access.membership?.role === "MANAGER";
    const isAssignee = task.assignedToId === access.user.id;

    if (!isManager && !isAssignee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, priority, dueDate, assignedToId, milestoneId, orderIndex } = body;

    const data: Record<string, unknown> = {};

    // Assignees can only update description
    if (isManager) {
      if (title != null) data.title = String(title).trim().slice(0, 300);
      if (priority != null && Object.values(TaskPriority).includes(priority)) data.priority = priority;
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
      if (orderIndex != null) data.orderIndex = Number(orderIndex);
      if (milestoneId !== undefined) {
        if (milestoneId) {
          const ms = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
          if (!ms) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
        }
        data.milestoneId = milestoneId ?? null;
      }
      if (assignedToId !== undefined) {
        if (assignedToId) {
          const member = await prisma.projectMember.findFirst({ where: { projectId, userId: assignedToId } });
          if (!member) return NextResponse.json({ error: "Assignee is not a project member" }, { status: 422 });
        }
        data.assignedToId = assignedToId ?? null;
      }
    }

    if (description != null) data.description = String(description).trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/tasks/[taskId]
// Business OWNER/MANAGER or ProjectMember OWNER/MANAGER
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;

    const businessAccess = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    const projectAccess = businessAccess
      ? null
      : await requireProjectMember(projectId, ["OWNER", "MANAGER"]);

    if (!businessAccess && !projectAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const actorId = businessAccess ? businessAccess.user.id : projectAccess!.user.id;

    const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    await prisma.task.delete({ where: { id: taskId } });

    logProjectActivity({
      projectId,
      entityType: "TASK",
      entityId: taskId,
      action: "TASK_DELETED",
      actorId,
      metadata: { title: task.title },
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
