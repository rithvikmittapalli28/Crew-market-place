import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; deliverableId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/deliverables/[deliverableId]
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { projectId, deliverableId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const deliverable = await prisma.deliverable.findFirst({
      where: { id: deliverableId, projectId },
      include: {
        milestone: { select: { id: true, title: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            submittedBy: { select: { id: true, name: true, avatarUrl: true } },
            file: { select: { id: true, fileName: true, mimeType: true, fileSize: true } },
            reviews: {
              include: {
                reviewer: { select: { id: true, name: true, avatarUrl: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!deliverable) {
      return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
    }

    const serializedDeliverable = {
      ...deliverable,
      versions: deliverable.versions.map((v) => ({
        ...v,
        file: v.file
          ? {
              ...v.file,
              fileSize: Number(v.file.fileSize),
            }
          : null,
      })),
    };

    return NextResponse.json({ deliverable: serializedDeliverable });
  } catch (error) {
    console.error("Get deliverable error:", error);
    return NextResponse.json({ error: "Failed to get deliverable" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[projectId]/deliverables/[deliverableId]
// Business OWNER/MANAGER only
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, deliverableId } = await params;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.deliverable.findFirst({
      where: { id: deliverableId, projectId },
    });
    if (!existing) return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, milestoneId } = body;

    const data: Record<string, unknown> = {};
    if (title != null) data.title = String(title).trim().slice(0, 300);
    if (description != null) data.description = String(description).trim();
    if (milestoneId !== undefined) {
      if (milestoneId) {
        const ms = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
        if (!ms) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      data.milestoneId = milestoneId ?? null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const deliverable = await prisma.deliverable.update({
      where: { id: deliverableId },
      data,
    });

    return NextResponse.json({ success: true, deliverable });
  } catch (error) {
    console.error("Update deliverable error:", error);
    return NextResponse.json({ error: "Failed to update deliverable" }, { status: 500 });
  }
}
