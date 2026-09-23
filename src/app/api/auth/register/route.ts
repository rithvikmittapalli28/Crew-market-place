import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/auth/password";
import { createSession, generateSecureToken, hashToken } from "@/lib/auth/session";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { getEmailService } from "@/lib/email";
import { logAuthEvent } from "@/lib/auth/audit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limitResult = await rateLimit(`register:${ip}`, 15, 60 * 60 * 1000); // 15 per hour
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parseResult.data;

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }

    // Hash password securely with bcryptjs
    const passwordHash = await hashPassword(password);

    // Create user in database with isVerified=false
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        isVerified: false,
        onboarded: false,
        isActive: true,
      },
    });

    // Generate 256-bit cryptographically secure verification token
    const rawVerificationToken = generateSecureToken(32);
    const tokenHash = hashToken(rawVerificationToken);
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiry

    // Store only the secure hash in PostgreSQL
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        tokenHash,
        expiresAt: tokenExpiresAt,
      },
    });

    // Dispatch raw token only via email link
    const emailService = getEmailService();
    await emailService.sendVerificationEmail(user.email, rawVerificationToken);

    // Create limited authenticated session
    const userAgent = req.headers.get("user-agent") || undefined;
    await createSession({
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });

    // Record audit event
    await logAuthEvent({
      action: "REGISTRATION",
      userId: user.id,
      actorId: user.id,
      ipAddress: ip,
      metadata: { role: user.role },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account registered successfully. Please verify your email to continue.",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
          onboarded: user.onboarded,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
