import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isRecentAuthentication } from "@/lib/auth/server";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { logAuthEvent } from "@/lib/auth/audit";
import { getClientIp } from "@/lib/auth/rate-limit";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(/[A-Z]/, "New password must include at least one uppercase letter")
    .regex(/[0-9]/, "New password must include at least one number"),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require recent authentication (within last 15 minutes) for password change
    const isRecent = await isRecentAuthentication(900);
    if (!isRecent) {
      return NextResponse.json(
        {
          error: "Recent authentication required for security-sensitive operations. Please re-authenticate.",
          reauthRequired: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = changePasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parseResult.data;

    // Load full user with passwordHash
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });

    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json(
        { error: "Account authentication state invalid." },
        { status: 400 }
      );
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "The current password entered is incorrect." },
        { status: 400 }
      );
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await logAuthEvent({
      action: "PASSWORD_CHANGED",
      userId: user.id,
      actorId: user.id,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while changing your password." },
      { status: 500 }
    );
  }
}
