import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getReportDetail, reviewReport } from "@/lib/moderation/service";
import type { ModerationStatus } from "@/types";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { reportId } = await context.params;

  try {
    const report = await getReportDetail(reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch (error: unknown) {
    console.error("Admin get report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load report" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { reportId } = await context.params;

  try {
    const body = await req.json();
    const { status, actionTaken, adminNotes } = body;
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const report = await reviewReport({
      reportId,
      adminUserId: auth.admin.id,
      status: status as ModerationStatus,
      actionTaken,
      adminNotes,
      ipAddress,
    });

    return NextResponse.json({ success: true, report });
  } catch (error: unknown) {
    console.error("Admin review report error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to review report" },
      { status: 400 }
    );
  }
}
