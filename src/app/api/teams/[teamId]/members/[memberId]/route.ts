import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { TeamRole } from "@prisma/client";

type Params = { params: Promise<{ teamId: string; memberId: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId]/members/[memberId] — update member role
// Only team leader can update roles
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { teamId, memberId } = await params;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    // Authorization: only team leader or admin
    if (team.leadFreelancerId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only the team leader can modify member roles" }, { status: 403 });
    }

    const member = await prisma.teamMember.findFirst({
      where: { id: memberId, teamId },
    });
    if (!member) return NextResponse.json({ error: "Team member not found" }, { status: 404 });

    // Cannot demote the primary leadFreelancer
    if (member.freelancerId === team.leadFreelancerId) {
      return NextResponse.json({ error: "Cannot change the team creator's role" }, { status: 422 });
    }

    const body = await req.json();
    const { role } = body;

    const allowedRoles: TeamRole[] = ["CORE_MEMBER", "COLLABORATOR", "LEADER"];
    if (!role || !allowedRoles.includes(role as TeamRole)) {
      return NextResponse.json({ error: "Invalid team role" }, { status: 400 });
    }

    const updated = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: role as TeamRole },
    });

    logProjectActivity({
      projectId: "GLOBAL",
      entityType: "TEAM_MEMBER",
      entityId: memberId,
      action: "TEAM_ROLE_UPDATED",
      actorId: user.id,
      metadata: { teamId, newRole: role },
    }).catch(console.error);

    return NextResponse.json({ success: true, member: updated });
  } catch (error) {
    console.error("Update team member error:", error);
    return NextResponse.json({ error: "Failed to update team member" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/teams/[teamId]/members/[memberId] — remove member from team
// Team leader OR the member removing themselves
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { teamId, memberId } = await params;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const member = await prisma.teamMember.findFirst({
      where: { id: memberId, teamId },
    });
    if (!member) return NextResponse.json({ error: "Team member not found" }, { status: 404 });

    // Check authorization: must be team leader OR the member removing themselves
    const isLeader = team.leadFreelancerId === user.id || user.role === "ADMIN";
    const isSelf = member.freelancerId === user.id;

    if (!isLeader && !isSelf) {
      return NextResponse.json({ error: "Forbidden: You cannot remove this member" }, { status: 403 });
    }

    // Cannot remove the lead freelancer unless deleting the entire team
    if (member.freelancerId === team.leadFreelancerId) {
      return NextResponse.json({ error: "The team lead cannot be removed from the team" }, { status: 422 });
    }

    await prisma.teamMember.delete({ where: { id: memberId } });

    logProjectActivity({
      projectId: "GLOBAL",
      entityType: "TEAM_MEMBER",
      entityId: memberId,
      action: "TEAM_MEMBER_REMOVED",
      actorId: user.id,
      metadata: { teamId, removedUserId: member.freelancerId },
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove team member error:", error);
    return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
  }
}
