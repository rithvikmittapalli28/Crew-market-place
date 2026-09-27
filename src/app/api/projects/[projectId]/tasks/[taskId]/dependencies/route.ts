import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

// ---------------------------------------------------------------------------
// BFS cycle detection for task dependencies
// ---------------------------------------------------------------------------
async function wouldCreateCycle(
  taskId: string,
  dependsOnTaskId: string,
  projectId: string
): Promise<boolean> {
  // If adding taskId → dependsOnTaskId would create a cycle,
  // it means dependsOnTaskId can already reach taskId through its dependencies.
  const visited = new Set<string>();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true; // cycle detected
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await prisma.taskDependency.findMany({
      where: { taskId: current, task: { projectId } },
      select: { dependsOnTaskId: true },
    });
    for (const dep of deps) {
      queue.push(dep.dependsOnTaskId);
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/tasks/[taskId]/dependencies
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const dependencies = await prisma.taskDependency.findMany({
      where: { taskId },
      include: {
        dependsOnTask: { select: { id: true, title: true, status: true } },
      },
    });

    return NextResponse.json({ dependencies });
  } catch (error) {
    console.error("List dependencies error:", error);
    return NextResponse.json({ error: "Failed to list dependencies" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/tasks/[taskId]/dependencies — add dependency
// Business OWNER/MANAGER or ProjectMember MANAGER
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { dependsOnTaskId } = body;

    if (!dependsOnTaskId || typeof dependsOnTaskId !== "string") {
      return NextResponse.json({ error: "dependsOnTaskId is required" }, { status: 400 });
    }

    if (dependsOnTaskId === taskId) {
      return NextResponse.json({ error: "A task cannot depend on itself" }, { status: 400 });
    }

    // Verify both tasks belong to this project
    const [task, dependsOnTask] = await Promise.all([
      prisma.task.findFirst({ where: { id: taskId, projectId } }),
      prisma.task.findFirst({ where: { id: dependsOnTaskId, projectId } }),
    ]);

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (!dependsOnTask) {
      return NextResponse.json({ error: "Dependency task not found in this project" }, { status: 404 });
    }

    // Cycle detection via BFS
    const cycle = await wouldCreateCycle(taskId, dependsOnTaskId, projectId);
    if (cycle) {
      return NextResponse.json(
        { error: "Adding this dependency would create a circular dependency chain" },
        { status: 422 }
      );
    }

    const dependency = await prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId },
      include: {
        dependsOnTask: { select: { id: true, title: true, status: true } },
      },
    });

    return NextResponse.json({ success: true, dependency }, { status: 201 });
  } catch (error: unknown) {
    // Unique constraint violation → dependency already exists
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Dependency already exists" }, { status: 409 });
    }
    console.error("Add dependency error:", error);
    return NextResponse.json({ error: "Failed to add dependency" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/tasks/[taskId]/dependencies
// Remove a dependency. Body: { dependsOnTaskId }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { dependsOnTaskId } = body;

    if (!dependsOnTaskId) {
      return NextResponse.json({ error: "dependsOnTaskId is required" }, { status: 400 });
    }

    await prisma.taskDependency.deleteMany({
      where: { taskId, dependsOnTaskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove dependency error:", error);
    return NextResponse.json({ error: "Failed to remove dependency" }, { status: 500 });
  }
}
