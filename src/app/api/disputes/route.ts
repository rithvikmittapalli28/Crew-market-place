import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createDispute, listDisputes } from "@/lib/disputes/service";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const user = await getCurrentUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const result = await listDisputes({
      userId: user.id,
      projectId,
      status,
      page,
      limit,
      isAdmin: user.role === "ADMIN",
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("List disputes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list disputes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const user = await getCurrentUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { projectId, milestoneId, contractId, category, reason, messageContent, attachmentFileId } = body;
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    if (!projectId || !category?.trim() || !reason?.trim()) {
      return NextResponse.json(
        { error: "Project ID, dispute category, and reason description are required" },
        { status: 400 }
      );
    }

    const dispute = await createDispute({
      projectId,
      milestoneId,
      contractId,
      initiatorId: user.id,
      category: category.trim(),
      reason: reason.trim(),
      messageContent,
      attachmentFileId,
      ipAddress,
    });

    return NextResponse.json({ success: true, dispute }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create dispute error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create dispute" },
      { status: 400 }
    );
  }
}
