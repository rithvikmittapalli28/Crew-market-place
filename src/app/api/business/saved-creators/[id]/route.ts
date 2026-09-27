import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try deleting by primary key id or composite match
    const result = await prisma.savedCreator.deleteMany({
      where: {
        userId: user.id,
        OR: [{ id }, { freelancerId: id }],
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Saved creator not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Creator removed from saved" });
  } catch (error) {
    console.error("Delete saved creator error:", error);
    return NextResponse.json({ error: "Failed to remove saved creator" }, { status: 500 });
  }
}
