import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getDispute, addDisputeMessage } from "@/lib/disputes/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  const token =
    req.cookies.get("crewn_session")?.value ||
    req.cookies.get("auth_token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    undefined;
  const user = await getCurrentUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { disputeId } = await context.params;

  try {
    const dispute = await getDispute(disputeId, user.id, user.role === "ADMIN");
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found or unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ dispute });
  } catch (error: unknown) {
    console.error("Get dispute detail error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load dispute" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  const token =
    req.cookies.get("crewn_session")?.value ||
    req.cookies.get("auth_token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    undefined;
  const user = await getCurrentUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { disputeId } = await context.params;

  try {
    const body = await req.json();
    const content = body.content || body.message;
    const { attachmentFileId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const message = await addDisputeMessage({
      disputeId,
      senderId: user.id,
      content: content.trim(),
      attachmentFileId,
      isAdmin: user.role === "ADMIN",
    });

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error: unknown) {
    console.error("Post dispute message error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post message" },
      { status: 400 }
    );
  }
}
