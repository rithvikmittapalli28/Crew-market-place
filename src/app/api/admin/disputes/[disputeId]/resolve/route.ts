import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { resolveDispute } from "@/lib/disputes/service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { disputeId } = await context.params;

  try {
    const body = await req.json();
    const resolutionAction = body.resolutionAction || body.action;
    const resolutionText = body.resolutionText || body.adminNotes;
    const adminNotes = body.adminNotes;
    const { refundAmount, releaseAmount } = body;
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    if (!resolutionAction || !resolutionText?.trim()) {
      return NextResponse.json(
        { error: "Resolution action and explanation text are required" },
        { status: 400 }
      );
    }

    const resolved = await resolveDispute({
      disputeId,
      adminUserId: auth.admin.id,
      resolutionAction,
      resolutionText: resolutionText.trim(),
      adminNotes,
      refundAmount: refundAmount !== undefined ? parseFloat(String(refundAmount)) : undefined,
      releaseAmount: releaseAmount !== undefined ? parseFloat(String(releaseAmount)) : undefined,
      ipAddress,
    });

    return NextResponse.json({ success: true, dispute: resolved });
  } catch (error: unknown) {
    console.error("Admin resolve dispute error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve dispute" },
      { status: 400 }
    );
  }
}
