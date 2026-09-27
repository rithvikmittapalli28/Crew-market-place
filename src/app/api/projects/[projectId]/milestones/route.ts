import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/milestones
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: "asc" },
      include: {
        _count: { select: { tasks: true, deliverables: true } },
      },
    });

    return NextResponse.json({ milestones });
  } catch (error) {
    console.error("List milestones error:", error);
    return NextResponse.json({ error: "Failed to list milestones" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/milestones — create milestone
// Business OWNER or MANAGER only
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { title, description, amount, dueDate } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Milestone title is required" }, { status: 400 });
    }

    const parsedAmount = parseFloat(String(amount ?? "0"));
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        title: title.trim().slice(0, 200),
        description: description ? String(description).trim() : null,
        amount: parsedAmount,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    logProjectActivity({
      projectId,
      entityType: "MILESTONE",
      entityId: milestone.id,
      action: "MILESTONE_CREATED",
      actorId: access.user.id,
      metadata: { title: milestone.title },
    }).catch(console.error);

    return NextResponse.json({ success: true, milestone }, { status: 201 });
  } catch (error) {
    console.error("Create milestone error:", error);
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}
