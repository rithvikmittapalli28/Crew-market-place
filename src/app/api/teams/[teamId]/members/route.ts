import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import crypto from "crypto";
import { TeamRole } from "@prisma/client";

type Params = { params: Promise<{ teamId: string }> };

// ---------------------------------------------------------------------------
// GET /api/teams/[teamId]/members — list team members
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            freelancer: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                freelancerProfile: {
                  select: {
                    id: true,
                    headline: true,
                    isVerified: true,
                    hourlyRate: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        invitations: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    return NextResponse.json({
      members: team.members,
      invitations: team.invitations,
    });
  } catch (error) {
    console.error("List team members error:", error);
    return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/members — add or invite a member to the team
// Only team leader can add members
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { teamId } = await params;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    // Authorization: only team leader or admin can add/invite members
    if (team.leadFreelancerId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the team leader can invite or add team members" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, freelancerId, role = "COLLABORATOR", directAdd = false } = body;

    const allowedRoles: TeamRole[] = ["CORE_MEMBER", "COLLABORATOR", "LEADER"];
    const memberRole: TeamRole = allowedRoles.includes(role as TeamRole) ? (role as TeamRole) : "COLLABORATOR";

    let targetUser = null;
    if (freelancerId) {
      targetUser = await prisma.user.findUnique({ where: { id: freelancerId } });
    } else if (email && typeof email === "string") {
      targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    }

    // If target user exists in DB
    if (targetUser) {
      // Check if already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_freelancerId: { teamId, freelancerId: targetUser.id } },
      });

      if (existingMember) {
        return NextResponse.json({ error: "User is already a member of this team" }, { status: 409 });
      }

      // If directAdd is true or invited by ID/registered email, add directly as TeamMember
      if (directAdd || targetUser) {
        const newMember = await prisma.teamMember.create({
          data: {
            teamId,
            freelancerId: targetUser.id,
            role: memberRole,
          },
          include: {
            freelancer: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                freelancerProfile: { select: { headline: true } },
              },
            },
          },
        });

        logProjectActivity({
          projectId: "GLOBAL",
          entityType: "TEAM_MEMBER",
          entityId: newMember.id,
          action: "TEAM_MEMBER_ADDED",
          actorId: user.id,
          metadata: {
            teamId,
            teamName: team.name,
            addedUserId: targetUser.id,
            role: memberRole,
          },
        }).catch(console.error);

        return NextResponse.json({ success: true, member: newMember }, { status: 201 });
      }
    }

    // Otherwise, create a TeamInvitation by email
    const inviteEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    if (!inviteEmail || !inviteEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email or existing user is required" }, { status: 400 });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        inviteeEmail: inviteEmail,
        role: memberRole,
        token: rawToken,
        tokenHash,
        expiresAt,
      },
    });

    logProjectActivity({
      projectId: "GLOBAL",
      entityType: "TEAM_INVITATION",
      entityId: invitation.id,
      action: "TEAM_MEMBER_INVITED",
      actorId: user.id,
      metadata: {
        teamId,
        teamName: team.name,
        inviteeEmail: inviteEmail,
        role: memberRole,
      },
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      invitation,
      invitationUrl: `/teams/invitations/${rawToken}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Add team member error:", error);
    return NextResponse.json({ error: "Failed to add team member" }, { status: 500 });
  }
}
