import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import crypto from "crypto";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/members — list project members
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
            freelancerProfile: { select: { headline: true, hourlyRate: true } },
          },
        },
        team: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    const invitations = await prisma.projectInvitation.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ members, invitations });
  } catch (error) {
    console.error("List members error:", error);
    return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/members — invite a freelancer by email OR assign a team
// Business OWNER or MANAGER only
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { email, role, teamId, freelancerId } = body;

    // CASE 1: Assign an entire Team to the project
    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: {
              freelancer: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      if (team.members.length === 0) {
        return NextResponse.json({ error: "Team has no members" }, { status: 400 });
      }

      const addedMembers = [];
      for (const tm of team.members) {
        const existing = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: tm.freelancerId } },
        });

        if (!existing) {
          const pm = await prisma.projectMember.create({
            data: {
              projectId,
              userId: tm.freelancerId,
              teamId: team.id,
              role: tm.role === "LEADER" ? "MANAGER" : "TEAM_MEMBER",
            },
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
              team: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          });
          addedMembers.push(pm);
        } else if (!existing.teamId) {
          // If already in project without team affiliation, associate with this team
          const pm = await prisma.projectMember.update({
            where: { id: existing.id },
            data: { teamId: team.id },
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
              team: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          });
          addedMembers.push(pm);
        }
      }

      logProjectActivity({
        projectId,
        entityType: "TEAM",
        entityId: team.id,
        action: "TEAM_ASSIGNED_TO_PROJECT",
        actorId: access.user.id,
        metadata: {
          teamName: team.name,
          addedCount: addedMembers.length,
          totalTeamMembers: team.members.length,
        },
      }).catch(console.error);

      return NextResponse.json({
        success: true,
        message: `Team "${team.name}" added to project`,
        members: addedMembers,
      }, { status: 201 });
    }

    // CASE 2: Directly add existing freelancer by ID
    if (freelancerId) {
      const targetUser = await prisma.user.findUnique({ where: { id: freelancerId } });
      if (!targetUser) {
        return NextResponse.json({ error: "Freelancer not found" }, { status: 404 });
      }

      const existing = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: targetUser.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "User is already a project member" }, { status: 409 });
      }

      const allowedRoles = ["FREELANCER", "MANAGER", "TEAM_MEMBER"];
      const memberRole = allowedRoles.includes(role) ? role : "FREELANCER";

      const newMember = await prisma.projectMember.create({
        data: {
          projectId,
          userId: targetUser.id,
          role: memberRole,
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        },
      });

      logProjectActivity({
        projectId,
        entityType: "PROJECT_MEMBER",
        entityId: newMember.id,
        action: "PROJECT_MEMBER_ADDED",
        actorId: access.user.id,
        metadata: { userId: targetUser.id, role: memberRole },
      }).catch(console.error);

      return NextResponse.json({ success: true, member: newMember }, { status: 201 });
    }

    // CASE 3: Invite freelancer by email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid invitee email, teamId, or freelancerId is required" }, { status: 400 });
    }

    const allowedRoles = ["FREELANCER", "MANAGER", "TEAM_MEMBER"];
    const memberRole = allowedRoles.includes(role) ? role : "FREELANCER";

    // Check if this email is already a project member
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });

    if (existingUser) {
      const alreadyMember = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: existingUser.id } },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: "User is already a project member" }, { status: 409 });
      }
    }

    // Cancel any existing pending invitations for this email on this project
    await prisma.projectInvitation.updateMany({
      where: { projectId, inviteeEmail: email.toLowerCase().trim(), status: "PENDING" },
      data: { status: "EXPIRED" },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.projectInvitation.create({
      data: {
        projectId,
        inviteeEmail: email.toLowerCase().trim(),
        role: memberRole,
        token: rawToken,
        tokenHash,
        expiresAt,
      },
    });

    logProjectActivity({
      projectId,
      entityType: "PROJECT_INVITATION",
      entityId: invitation.id,
      action: "MEMBER_INVITED",
      actorId: access.user.id,
      metadata: { inviteeEmail: invitation.inviteeEmail, role: memberRole },
    }).catch(console.error);

    // In production, email the invitation link here.
    // For now, return the token so the frontend can show the link.
    const invitationUrl = `/invitations/${rawToken}`;

    return NextResponse.json({ success: true, invitation, invitationUrl }, { status: 201 });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}
