import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailSchema } from "@/lib/validations/auth";
import { hashToken } from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/auth/audit";
import { getClientIp } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json().catch(() => null);
    const parseResult = verifyEmailSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid verification token format" },
        { status: 400 }
      );
    }

    const { token: rawToken } = parseResult.data;

    // Hash the raw token to match against the database hash
    const tokenHash = hashToken(rawToken);

    // Find verification record by tokenHash
    const record = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "The verification link is invalid or has expired." },
        { status: 400 }
      );
    }

    // Update user verification status in database
    const user = await prisma.user.update({
      where: { email: record.identifier },
      data: { isVerified: true },
    });

    // Invalidate the token immediately (single-use guarantee)
    await prisma.verificationToken.delete({
      where: { id: record.id },
    }).catch(() => {});

    // Record audit event
    await logAuthEvent({
      action: "EMAIL_VERIFIED",
      userId: user.id,
      actorId: user.id,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        onboarded: user.onboarded,
      },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during email verification." },
      { status: 500 }
    );
  }
}
