import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ teamId: string }> };

// ---------------------------------------------------------------------------
// GET /api/teams/[teamId] — get team details
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: teamId }, { slug: teamId }],
      },
      include: {
        leadFreelancer: {
          select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
        },
        members: {
          include: {
            freelancer: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                email: true,
                freelancerProfile: { select: { headline: true, hourlyRate: true } },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        assignedProjects: {
          include: {
            project: { select: { id: true, title: true, status: true } },
          },
        },
        _count: { select: { members: true, assignedProjects: true } },
      },
    });

    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    return NextResponse.json({ team });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId] — update team details (leader only)
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { teamId } = await params;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    if (team.leadFreelancerId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only the team leader can update team settings" }, { status: 403 });
    }

    const body = await req.json();
    const { name, tagline, bio, logoUrl } = body;

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(name && typeof name === "string" ? { name: name.trim().slice(0, 100) } : {}),
        ...(tagline !== undefined ? { tagline: tagline ? String(tagline).trim().slice(0, 200) : null } : {}),
        ...(bio !== undefined ? { bio: bio ? String(bio).trim() : null } : {}),
        ...(logoUrl !== undefined ? { logoUrl: logoUrl ? String(logoUrl).trim() : null } : {}),
      },
    });

    return NextResponse.json({ success: true, team: updated });
  } catch (error) {
    console.error("Update team error:", error);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/teams/[teamId] — disband team (leader only)
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { teamId } = await params;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    if (team.leadFreelancerId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only the team leader can disband the team" }, { status: 403 });
    }

    await prisma.team.delete({ where: { id: teamId } });

    logProjectActivity({
      projectId: "GLOBAL",
      entityType: "TEAM",
      entityId: teamId,
      action: "TEAM_DELETED",
      actorId: user.id,
      metadata: { teamName: team.name },
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }
}
