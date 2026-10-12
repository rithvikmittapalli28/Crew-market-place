import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getDispute, updateDisputeStatus, addDisputeMessage } from "@/lib/disputes/service";
import type { DisputeStatus } from "@/types";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { disputeId } = await context.params;

  try {
    const dispute = await getDispute(disputeId, auth.admin.id, true);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }
    return NextResponse.json({ dispute });
  } catch (error: unknown) {
    console.error("Admin dispute detail error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dispute" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { disputeId } = await context.params;

  try {
    const body = await req.json();
    const { status, adminNotes } = body;
    const ipAddress = req.headers.get("x-forwarded-for") || null;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    const updated = await updateDisputeStatus({
      disputeId,
      status: status as DisputeStatus,
      adminUserId: auth.admin.id,
      adminNotes,
      ipAddress,
    });

    return NextResponse.json({ success: true, dispute: updated });
  } catch (error: unknown) {
    console.error("Admin update dispute status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update dispute status" },
      { status: 400 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const { disputeId } = await context.params;

  try {
    const body = await req.json();
    const { content, attachmentFileId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const message = await addDisputeMessage({
      disputeId,
      senderId: auth.admin.id,
      content: content.trim(),
      attachmentFileId,
      isAdmin: true,
    });

    return NextResponse.json({ success: true, message });
  } catch (error: unknown) {
    console.error("Admin post dispute message error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post message" },
      { status: 400 }
    );
  }
}
