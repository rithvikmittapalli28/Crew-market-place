import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminUsers } from "@/lib/admin/service";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("crewn_session")?.value || req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const auth = await requireAdminApi(token);
  if (!auth.success) return auth.errorResponse;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const role = url.searchParams.get("role") || undefined;
  const status = (url.searchParams.get("status") as "active" | "suspended" | "all") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const result = await getAdminUsers({ search, role, status, page, limit });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Admin users list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list users" },
      { status: 500 }
    );
  }
}
