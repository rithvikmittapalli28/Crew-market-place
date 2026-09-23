import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions, hashToken } from "@/lib/auth/session";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limitResult = await rateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = resetPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { token: rawToken, password } = parseResult.data;

    // Hash the raw token to match against the database hash
    const tokenHash = hashToken(rawToken);

    // Verify token record in database
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "The password reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Lookup target user
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Account could not be found." },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt
    const newHash = await hashPassword(password);

    // Update password in database
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate the used token immediately (single-use token guarantee)
    await prisma.passwordResetToken.delete({
      where: { id: resetRecord.id },
    }).catch(() => {});

    // Invalidate all existing sessions after password reset
    await revokeAllUserSessions(user.id);

    // Record audit event
    await logAuthEvent({
      action: "PASSWORD_RESET_COMPLETED",
      userId: user.id,
      actorId: user.id,
      ipAddress: ip,
    });

    await logAuthEvent({
      action: "PASSWORD_CHANGED",
      userId: user.id,
      actorId: user.id,
      ipAddress: ip,
    });

    // Do NOT automatically log the user in; require normal sign in
    return NextResponse.json({
      success: true,
      message: "Your password has been successfully updated. You may now sign in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
