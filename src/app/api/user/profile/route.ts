import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const userProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
});

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parseResult = userProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, avatarUrl, phone } = parseResult.data;

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: {
        name: name !== undefined ? name : undefined,
        avatarUrl: avatarUrl !== undefined ? (avatarUrl || null) : undefined,
        phone: phone !== undefined ? (phone || null) : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        role: true,
        isVerified: true,
        onboarded: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: updated,
    });
  } catch (error) {
    console.error("User profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
