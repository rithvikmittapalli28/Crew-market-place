import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        business: { select: { id: true, name: true, slug: true, logoUrl: true } },
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            team: { select: { id: true, name: true, slug: true } },
          },
        },
        milestones: {
          orderBy: { dueDate: "asc" },
          include: {
            _count: { select: { tasks: true, deliverables: true } },
          },
        },
        tasks: {
          orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
          include: {
            assignedTo: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        deliverables: {
          include: {
            _count: { select: { versions: true } },
          },
        },
        _count: { select: { members: true, files: true } },
      },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json({ error: "Failed to get project" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId] — edit project fields
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { title, description, budgetMin, budgetMax, currency, startDate, deadline } = body;

    const data: Record<string, unknown> = {};
    if (title != null) data.title = String(title).trim().slice(0, 200);
    if (description != null) data.description = String(description).trim();
    if (budgetMin != null) data.budgetMin = parseFloat(String(budgetMin));
    if (budgetMax != null) data.budgetMax = parseFloat(String(budgetMax));
    if (currency != null) data.currency = String(currency).toUpperCase().slice(0, 3);
    if (startDate != null) data.startDate = startDate ? new Date(startDate) : null;
    if (deadline != null) data.deadline = deadline ? new Date(deadline) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    logProjectActivity({
      projectId,
      entityType: "PROJECT",
      entityId: projectId,
      action: "PROJECT_UPDATED",
      actorId: access.user.id,
      metadata: { fields: Object.keys(data) },
    }).catch(console.error);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId] — business OWNER only
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.project.delete({ where: { id: projectId } });

    logProjectActivity({
      projectId,
      entityType: "PROJECT",
      entityId: projectId,
      action: "PROJECT_DELETED",
      actorId: access.user.id,
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
