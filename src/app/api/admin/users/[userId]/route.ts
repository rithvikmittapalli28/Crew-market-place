import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getAdminUserDetail } from "@/lib/admin/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || undefined;
  const auth = await requireAdminApi(token);
  if (!auth.success) return auth.errorResponse;

  const { userId } = await context.params;

  try {
    const user = await getAdminUserDetail(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error("Admin user detail error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load user details" },
      { status: 500 }
    );
  }
}
