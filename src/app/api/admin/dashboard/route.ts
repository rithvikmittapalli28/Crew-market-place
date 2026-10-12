import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminDashboardMetrics } from "@/lib/admin/service";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("crewn_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const auth = await requireAdminApi(token);
  if (!auth.success) return auth.errorResponse;

  try {
    const metrics = await getAdminDashboardMetrics();
    return NextResponse.json(metrics);
  } catch (error: unknown) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load admin metrics" },
      { status: 500 }
    );
  }
}
