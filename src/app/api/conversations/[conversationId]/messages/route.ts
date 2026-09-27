import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { sendMessage } from "@/lib/messages/service";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 60 messages per minute
    const ip = getClientIp(req);
    const limitResult = await rateLimit(`messages:${user.id}:${ip}`, 60, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many messages sent. Please slow down." },
        { status: 429 }
      );
    }

    const { conversationId } = await params;
    const body = await req.json();
    const { content, attachmentFileIds } = body;

    if ((!content || typeof content !== "string" || !content.trim()) && (!Array.isArray(attachmentFileIds) || attachmentFileIds.length === 0)) {
      return NextResponse.json(
        { error: "Message content or attachment is required" },
        { status: 400 }
      );
    }

    const message = await sendMessage({
      conversationId,
      senderId: user.id,
      content: content || "",
      attachmentFileIds: Array.isArray(attachmentFileIds) ? attachmentFileIds : [],
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 400 }
    );
  }
}
