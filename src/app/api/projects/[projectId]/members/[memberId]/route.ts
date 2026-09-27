import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ projectId: string; memberId: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/members/[memberId] — update member role
// Business OWNER/MANAGER only
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, memberId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { role } = body;

    const allowedRoles = ["MANAGER", "FREELANCER", "TEAM_MEMBER"];
    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Verify member belongs to this project
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Cannot downgrade project OWNER via this endpoint
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Cannot change the project owner's role" }, { status: 422 });
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json({ success: true, member: updated });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[projectId]/members/[memberId] — remove a member
// Business OWNER/MANAGER OR the member removing themselves
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, memberId } = await params;

    // Verify the member to remove exists on this project
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Check self-removal or business authority
    const selfAccess = await requireProjectMember(projectId);
    if (!selfAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isSelf = member.userId === selfAccess.user.id;
    const isBusinessManager = selfAccess.isBusinessOverride;

    if (!isSelf && !isBusinessManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot remove project OWNER
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove the project owner" }, { status: 422 });
    }

    await prisma.projectMember.delete({ where: { id: memberId } });

    logProjectActivity({
      projectId,
      entityType: "PROJECT_MEMBER",
      entityId: memberId,
      action: "MEMBER_REMOVED",
      actorId: selfAccess.user.id,
      metadata: { removedUserId: member.userId },
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
