import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { listReports } from "@/lib/moderation/service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const targetType = url.searchParams.get("targetType") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const result = await listReports({ status, targetType, page, limit });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Admin list moderation reports error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list moderation reports" },
      { status: 500 }
    );
  }
}
