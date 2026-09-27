import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import crypto from "crypto";

type Params = { params: Promise<{ token: string }> };

// ---------------------------------------------------------------------------
// GET /api/teams/invitations/[token] — look up invitation
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        OR: [
          { token },
          { tokenHash: hashedToken },
        ],
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            tagline: true,
            logoUrl: true,
            leadFreelancer: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: `Invitation is already ${invitation.status.toLowerCase()}` }, { status: 410 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error("Get team invitation error:", error);
    return NextResponse.json({ error: "Failed to look up invitation" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/teams/invitations/[token] — accept invitation
// ---------------------------------------------------------------------------
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await params;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        OR: [
          { token },
          { tokenHash: hashedToken },
        ],
      },
      include: { team: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: `Invitation is already ${invitation.status.toLowerCase()}` }, { status: 410 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Verify recipient email
    if (invitation.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      );
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: { teamId_freelancerId: { teamId: invitation.teamId, freelancerId: user.id } },
    });

    if (existing) {
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });
      return NextResponse.json({ success: true, message: "Already a member of this team" });
    }

    // Create TeamMember & update invitation in a transaction
    const [member] = await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          freelancerId: user.id,
          role: invitation.role,
        },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    logProjectActivity({
      projectId: "GLOBAL",
      entityType: "TEAM_MEMBER",
      entityId: member.id,
      action: "TEAM_MEMBER_JOINED",
      actorId: user.id,
      metadata: {
        teamId: invitation.teamId,
        teamName: invitation.team.name,
        role: invitation.role,
      },
    }).catch(console.error);

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error("Accept team invitation error:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/teams/invitations/[token] — decline invitation
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await params;
    const invitation = await prisma.teamInvitation.findUnique({ where: { token } });

    if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

    if (invitation.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: "DECLINED" },
    });

    return NextResponse.json({ success: true, message: "Invitation declined" });
  } catch (error) {
    console.error("Decline team invitation error:", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
