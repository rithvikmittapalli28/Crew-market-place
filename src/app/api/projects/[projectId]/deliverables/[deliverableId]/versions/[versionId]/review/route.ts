import { NextRequest, NextResponse } from "next/server";
import { requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { ReviewDecision, DeliverableStatus } from "@prisma/client";
import { dispatchNotification } from "@/lib/notifications/service";

type Params = { params: Promise<{ projectId: string; deliverableId: string; versionId: string }> };

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/deliverables/[deliverableId]/versions/[versionId]/review
// Business OWNER/MANAGER reviews a version: APPROVED or REVISION_REQUESTED
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId, deliverableId, versionId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify version belongs to this deliverable in this project
    const version = await prisma.deliverableVersion.findFirst({
      where: { id: versionId, deliverableId, deliverable: { projectId } },
    });
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const body = await req.json();
    const { decision, feedbackText } = body;

    const allowedDecisions: ReviewDecision[] = ["APPROVED", "REVISION_REQUESTED"];
    if (!decision || !allowedDecisions.includes(decision)) {
      return NextResponse.json(
        { error: "decision must be APPROVED or REVISION_REQUESTED" },
        { status: 400 }
      );
    }

    if (!feedbackText || typeof feedbackText !== "string" || !feedbackText.trim()) {
      return NextResponse.json({ error: "feedbackText is required" }, { status: 400 });
    }

    // Map decision to deliverable status
    const deliverableStatus: DeliverableStatus =
      decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED";

    const [review] = await prisma.$transaction([
      prisma.deliverableReview.create({
        data: {
          versionId,
          reviewerId: access.user.id,
          decision,
          feedbackText: feedbackText.trim().slice(0, 5000),
        },
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.deliverable.update({
        where: { id: deliverableId },
        data: { status: deliverableStatus },
      }),
    ]);

    logProjectActivity({
      projectId,
      entityType: "DELIVERABLE",
      entityId: deliverableId,
      action: "VERSION_REVIEWED",
      actorId: access.user.id,
      metadata: { decision, versionId },
    }).catch(console.error);

    if (version.submittedById) {
      dispatchNotification({
        userId: version.submittedById,
        type: "DELIVERABLE",
        title: decision === "APPROVED" ? "Deliverable Approved" : "Revision Requested",
        body: `Your submission for deliverable has been reviewed: ${decision}. Feedback: "${feedbackText.trim().slice(0, 100)}"`,
        linkUrl: `/projects/${projectId}`,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, review, deliverableStatus }, { status: 201 });
  } catch (error) {
    console.error("Review version error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
