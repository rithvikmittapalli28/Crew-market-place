import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { listDisputes } from "@/lib/disputes/service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  try {
    const result = await listDisputes({ status, projectId, page, limit, isAdmin: true });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Admin list disputes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list disputes" },
      { status: 500 }
    );
  }
}
