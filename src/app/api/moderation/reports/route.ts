import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { submitReport } from "@/lib/moderation/service";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const user = await getCurrentUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { targetType, targetId, category, reason, evidenceJson } = body;
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    if (!targetType || !targetId || !category?.trim() || !reason?.trim()) {
      return NextResponse.json(
        { error: "Target type, target ID, category, and reason are required" },
        { status: 400 }
      );
    }

    const report = await submitReport({
      reporterId: user.id,
      targetType,
      targetId,
      category: category.trim(),
      reason: reason.trim(),
      evidenceJson,
      ipAddress,
    });

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error: unknown) {
    console.error("Submit moderation report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit report" },
      { status: 400 }
    );
  }
}
