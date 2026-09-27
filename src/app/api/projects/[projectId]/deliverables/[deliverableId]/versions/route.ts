import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type Params = { params: Promise<{ projectId: string; deliverableId: string }> };

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/deliverables/[deliverableId]/versions
// Freelancer project member submits a new version.
// Requires an existing File record owned by the submitter.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId, deliverableId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Freelancers can submit; business members can also submit (e.g., initial draft upload)
    const deliverable = await prisma.deliverable.findFirst({
      where: { id: deliverableId, projectId },
    });
    if (!deliverable) {
      return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
    }

    const body = await req.json();
    const { fileId, changelog } = body;

    if (!fileId || typeof fileId !== "string") {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    // Verify the file exists and belongs to the submitting user (IDOR protection)
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (file.uploadedById !== access.user.id) {
      return NextResponse.json(
        { error: "You can only submit files you uploaded" },
        { status: 403 }
      );
    }

    // Atomically: create version and increment currentVersionNumber
    const newVersionNumber = deliverable.currentVersionNumber + 1;

    const [version] = await prisma.$transaction([
      prisma.deliverableVersion.create({
        data: {
          deliverableId,
          versionNumber: newVersionNumber,
          fileId,
          submittedById: access.user.id,
          changelog: changelog ? String(changelog).trim() : null,
        },
        include: {
          file: { select: { id: true, fileName: true, mimeType: true, fileSize: true } },
          submittedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.deliverable.update({
        where: { id: deliverableId },
        data: {
          currentVersionNumber: newVersionNumber,
          status: "SUBMITTED",
        },
      }),
    ]);

    logProjectActivity({
      projectId,
      entityType: "DELIVERABLE",
      entityId: deliverableId,
      action: "VERSION_SUBMITTED",
      actorId: access.user.id,
      metadata: { versionNumber: newVersionNumber, deliverableTitle: deliverable.title },
    }).catch(console.error);

    return NextResponse.json({ success: true, version }, { status: 201 });
  } catch (error) {
    console.error("Submit version error:", error);
    return NextResponse.json({ error: "Failed to submit version" }, { status: 500 });
  }
}
