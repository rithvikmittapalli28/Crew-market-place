import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/deliverables
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const deliverables = await prisma.deliverable.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        milestone: { select: { id: true, title: true } },
        _count: { select: { versions: true } },
      },
    });

    return NextResponse.json({ deliverables });
  } catch (error) {
    console.error("List deliverables error:", error);
    return NextResponse.json({ error: "Failed to list deliverables" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/deliverables — create deliverable
// Business OWNER/MANAGER only
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { title, description, milestoneId } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Deliverable title is required" }, { status: 400 });
    }

    if (milestoneId) {
      const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found in this project" }, { status: 404 });
      }
    }

    const deliverable = await prisma.deliverable.create({
      data: {
        projectId,
        title: title.trim().slice(0, 300),
        description: description ? String(description).trim() : null,
        milestoneId: milestoneId ?? null,
      },
      include: {
        milestone: { select: { id: true, title: true } },
      },
    });

    logProjectActivity({
      projectId,
      entityType: "DELIVERABLE",
      entityId: deliverable.id,
      action: "DELIVERABLE_CREATED",
      actorId: access.user.id,
      metadata: { title: deliverable.title },
    }).catch(console.error);

    return NextResponse.json({ success: true, deliverable }, { status: 201 });
  } catch (error) {
    console.error("Create deliverable error:", error);
    return NextResponse.json({ error: "Failed to create deliverable" }, { status: 500 });
  }
}
