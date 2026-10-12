import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { suspendUser } from "@/lib/admin/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { userId } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason?.trim() || "Administrative suspension for platform policy violation";
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    const user = await suspendUser({
      userId,
      adminUserId: auth.admin.id,
      reason,
      ipAddress,
    });

    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    console.error("Admin user suspend error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to suspend user" },
      { status: 400 }
    );
  }
}
