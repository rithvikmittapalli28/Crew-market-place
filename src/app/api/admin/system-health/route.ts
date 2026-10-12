import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminSystemHealth } from "@/lib/admin/service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  try {
    const health = await getAdminSystemHealth();
    return NextResponse.json(health);
  } catch (error: unknown) {
    console.error("Admin system health error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load system health" },
      { status: 500 }
    );
  }
}
