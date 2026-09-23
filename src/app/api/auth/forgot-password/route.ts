import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { getEmailService } from "@/lib/email";
import { generateSecureToken, hashToken } from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/auth/audit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    // Rate-limit per IP source
    const ipLimit = await rateLimit(`forgot-password:ip:${ip}`, 5, 15 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Too many reset requests. Please wait a few minutes before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = forgotPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const { email } = parseResult.data;

    // Rate-limit per target account
    const accountLimit = await rateLimit(`forgot-password:account:${email}`, 3, 15 * 60 * 1000);
    if (!accountLimit.success) {
      return NextResponse.json(
        { error: "Too many reset requests for this account. Please wait a few minutes." },
        { status: 429 }
      );
    }

    // Lookup user in database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user && user.isActive) {
      // Invalidate existing reset tokens for this email
      await prisma.passwordResetToken.deleteMany({
        where: { email },
      }).catch(() => {});

      // Generate 256-bit cryptographically random token
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour expiry

      // Store only the secure hash in PostgreSQL
      await prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash,
          expiresAt,
        },
      });

      // Send raw token only via email link
      const emailService = getEmailService();
      await emailService.sendPasswordResetEmail(email, rawToken);

      await logAuthEvent({
        action: "PASSWORD_RESET_REQUESTED",
        userId: user.id,
        actorId: user.id,
        ipAddress: ip,
      });
    }

    // Always maintain identical safe responses to prevent account enumeration
    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email address, you will receive password recovery instructions shortly.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
