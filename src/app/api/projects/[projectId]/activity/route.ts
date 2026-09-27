import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/activity — paginated activity log
// Any project member or business member
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = Math.min(Number(url.searchParams.get("take") ?? "20"), 50);

    const allLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { projectId },
          { entityId: projectId },
          {
            metadataJson: { contains: projectId },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const nextCursor = allLogs.length === take ? allLogs[allLogs.length - 1].id : null;

    return NextResponse.json({ logs: allLogs, nextCursor });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
  }
}
