import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ projectId: string; taskId: string }> };

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/tasks/[taskId]/comments
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = Math.min(Number(url.searchParams.get("take") ?? "50"), 100);

    // Verify task belongs to project
    const task = await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const nextCursor = comments.length === take ? comments[comments.length - 1].id : null;

    return NextResponse.json({ comments, nextCursor });
  } catch (error) {
    console.error("List comments error:", error);
    return NextResponse.json({ error: "Failed to list comments" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/tasks/[taskId]/comments — add a comment
// Any project member
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectMember(projectId);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const task = await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        authorId: access.user.id,
        content: content.trim().slice(0, 5000),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
