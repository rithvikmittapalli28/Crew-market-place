import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ projectId: string; milestoneId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/milestones/[milestoneId]
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, milestoneId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
      include: {
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { orderIndex: "asc" },
        },
        deliverables: {
          include: {
            _count: { select: { versions: true } },
          },
        },
      },
    });

    if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

    return NextResponse.json({ milestone });
  } catch (error) {
    console.error("Get milestone error:", error);
    return NextResponse.json({ error: "Failed to get milestone" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/milestones/[milestoneId]
// Business OWNER or MANAGER only
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, milestoneId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify milestone belongs to this project
    const existing = await prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, amount, dueDate, freelancerId } = body;

    const data: Record<string, unknown> = {};
    if (title != null) data.title = String(title).trim().slice(0, 200);
    if (description != null) data.description = String(description).trim();
    if (freelancerId !== undefined) data.freelancerId = freelancerId ? String(freelancerId) : null;
    if (amount != null) {
      // Check if escrow is already held or released
      const activeEscrow = await prisma.milestonePayment.findFirst({
        where: {
          milestoneId,
          status: { in: ["HELD_IN_ESCROW", "RELEASED"] },
        },
      });
      if (activeEscrow) {
        return NextResponse.json(
          { error: "Cannot modify milestone amount while funds are held in escrow or released" },
          { status: 422 }
        );
      }

      const parsed = parseFloat(String(amount));
      if (!isNaN(parsed) && parsed >= 0) data.amount = parsed;
    }
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    const milestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data,
    });

    return NextResponse.json({ success: true, milestone });
  } catch (error) {
    console.error("Update milestone error:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/milestones/[milestoneId]
// Business OWNER only. Only allowed when milestone status is PENDING and no payments exist.
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, milestoneId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

    if (milestone.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only PENDING milestones can be deleted" },
        { status: 422 }
      );
    }

    const hasPayments = await prisma.milestonePayment.findFirst({
      where: { milestoneId },
    });
    if (hasPayments) {
      return NextResponse.json(
        { error: "Cannot delete milestone with associated payment transactions" },
        { status: 422 }
      );
    }

    await prisma.milestone.delete({ where: { id: milestoneId } });

    logProjectActivity({
      projectId,
      entityType: "MILESTONE",
      entityId: milestoneId,
      action: "MILESTONE_DELETED",
      actorId: access.user.id,
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete milestone error:", error);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}
