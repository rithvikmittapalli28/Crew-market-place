import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { TaskPriority, TaskStatus } from "@prisma/client";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/tasks — list tasks (optional filters)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const milestoneId = url.searchParams.get("milestoneId") || undefined;
    const assignedToId = url.searchParams.get("assignedToId") || undefined;
    const status = url.searchParams.get("status") as TaskStatus | null;

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        ...(milestoneId ? { milestoneId } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        milestone: { select: { id: true, title: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("List tasks error:", error);
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/tasks — create task
// Business OWNER/MANAGER or ProjectMember MANAGER
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;

    // Check business access first
    const businessAccess = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    const projectAccess = businessAccess
      ? null
      : await requireProjectMember(projectId, ["OWNER", "MANAGER"]);

    if (!businessAccess && !projectAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const actorUser = businessAccess ? businessAccess.user : projectAccess!.user;

    const body = await req.json();
    const {
      title,
      description,
      priority,
      milestoneId,
      assignedToId,
      dueDate,
      orderIndex,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const allowedPriorities = Object.values(TaskPriority);
    const taskPriority = allowedPriorities.includes(priority) ? priority : TaskPriority.MEDIUM;

    // If milestoneId is provided, verify it belongs to this project
    if (milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: { id: milestoneId, projectId },
      });
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found in this project" }, { status: 404 });
      }
    }

    // If assignedToId is provided, verify they are a project member
    if (assignedToId) {
      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId: assignedToId },
      });
      if (!member) {
        return NextResponse.json(
          { error: "Assigned user is not a member of this project" },
          { status: 422 }
        );
      }
    }

    // Get current max orderIndex for this project/milestone
    let order = typeof orderIndex === "number" ? orderIndex : 0;
    if (typeof orderIndex !== "number") {
      const maxTask = await prisma.task.findFirst({
        where: { projectId, milestoneId: milestoneId ?? null },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });
      order = (maxTask?.orderIndex ?? -1) + 1;
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        milestoneId: milestoneId ?? null,
        assignedToId: assignedToId ?? null,
        title: title.trim().slice(0, 300),
        description: description ? String(description).trim() : null,
        priority: taskPriority,
        dueDate: dueDate ? new Date(dueDate) : null,
        orderIndex: order,
      },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        milestone: { select: { id: true, title: true } },
      },
    });

    logProjectActivity({
      projectId,
      entityType: "TASK",
      entityId: task.id,
      action: "TASK_CREATED",
      actorId: actorUser.id,
      metadata: { title: task.title, priority: task.priority },
    }).catch(console.error);

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
