import { NextRequest, NextResponse } from "next/server";
import { requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { isValidProjectTransition } from "@/lib/projects/validate-status-transition";
import type { ProjectStatus } from "@/types";
import { ProjectStatus as PrismaProjectStatus } from "@prisma/client";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/status — transition project status
// Business OWNER or MANAGER only
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { status: toStatus } = body;

    if (!toStatus || typeof toStatus !== "string") {
      return NextResponse.json({ error: "status field is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const from = project.status as ProjectStatus;
    const to = toStatus as ProjectStatus;

    if (!isValidProjectTransition(from, to)) {
      return NextResponse.json(
        { error: `Cannot transition project from ${from} to ${to}` },
        { status: 422 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status: to as PrismaProjectStatus },
    });

    logProjectActivity({
      projectId,
      entityType: "PROJECT",
      entityId: projectId,
      action: "PROJECT_STATUS_CHANGED",
      actorId: access.user.id,
      metadata: { from, to },
    }).catch(console.error);

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Project status transition error:", error);
    return NextResponse.json({ error: "Failed to update project status" }, { status: 500 });
  }
}
