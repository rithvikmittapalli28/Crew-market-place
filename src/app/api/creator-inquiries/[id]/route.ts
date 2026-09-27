import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inquiry = await prisma.creatorInquiry.findUnique({
      where: { id },
      include: {
        freelancer: true,
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    const isSender = inquiry.senderId === user.id;
    const isRecipientFreelancer = inquiry.freelancer.userId === user.id;

    if (!isSender && !isRecipientFreelancer && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to update this inquiry" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !Object.values(InquiryStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid inquiry status" }, { status: 400 });
    }

    // Senders can only cancel
    if (isSender && !isRecipientFreelancer && status !== InquiryStatus.CANCELLED) {
      return NextResponse.json(
        { error: "Senders can only cancel an inquiry" },
        { status: 400 }
      );
    }

    const updated = await prisma.creatorInquiry.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (error) {
    console.error("Update inquiry error:", error);
    return NextResponse.json({ error: "Failed to update inquiry" }, { status: 500 });
  }
}
