import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { ProjectMemberRole } from "@prisma/client";
import crypto from "crypto";

type Params = { params: Promise<{ token: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/invitations/[token] — look up invitation details
// Public endpoint (unauthenticated) — returns minimal safe data for the accept page
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const invitation = await prisma.projectInvitation.findFirst({
      where: {
        OR: [
          { token },
          { tokenHash: hashedToken },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            business: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invitation has already been used or has expired", status: invitation.status },
        { status: 410 }
      );
    }

    if (invitation.expiresAt <= new Date()) {
      // Mark as expired
      await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      }).catch(() => {});
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        inviteeEmail: invitation.inviteeEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        project: invitation.project,
      },
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    return NextResponse.json({ error: "Failed to fetch invitation" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/invitations/[token] — accept invitation
// Authenticated freelancer only. Must match invitation email.
// ---------------------------------------------------------------------------
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const invitation = await prisma.projectInvitation.findFirst({
      where: {
        OR: [
          { token },
          { tokenHash: hashedToken },
        ],
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 410 });
    }

    if (invitation.expiresAt <= new Date()) {
      await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      }).catch(() => {});
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Email must match — prevents accepting other people's invitations
    if (user.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      );
    }

    // Check not already a member
    const alreadyMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } },
    });
    if (alreadyMember) {
      // Mark invitation accepted anyway and return gracefully
      await prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });
      return NextResponse.json({ success: true, alreadyMember: true });
    }

    // Atomic: create member + mark invitation accepted
    await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId: user.id,
          role: invitation.role as ProjectMemberRole,
        },
      }),
      prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    logProjectActivity({
      projectId: invitation.projectId,
      entityType: "PROJECT_MEMBER",
      entityId: invitation.id,
      action: "MEMBER_JOINED",
      actorId: user.id,
      metadata: { role: invitation.role },
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      projectId: invitation.projectId,
      role: invitation.role,
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/invitations/[token] — decline invitation
// Authenticated user whose email matches the invitation
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const invitation = await prisma.projectInvitation.findUnique({
      where: { token },
    });

    if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "Invitation is no longer pending" }, { status: 410 });
    }

    if (user.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.projectInvitation.update({
      where: { id: invitation.id },
      data: { status: "DECLINED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Decline invitation error:", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
