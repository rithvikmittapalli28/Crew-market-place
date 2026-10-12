import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { reactivateUser } from "@/lib/admin/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { userId } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason?.trim() || "Administrative reactivation";
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    const user = await reactivateUser({
      userId,
      adminUserId: auth.admin.id,
      reason,
      ipAddress,
    });

    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    console.error("Admin user reactivate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reactivate user" },
      { status: 400 }
    );
  }
}
