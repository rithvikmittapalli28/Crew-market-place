import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { logAuthEvent } from "@/lib/auth/audit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json().catch(() => null);
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid login credentials format",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // Rate limit per IP + email: max 5 attempts per 15 mins
    const limitKey = `login:${ip}:${email}`;
    const limitResult = await rateLimit(limitKey, 5, 15 * 60 * 1000);
    if (!limitResult.success) {
      const waitMinutes = Math.ceil((limitResult.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        {
          error: `Too many login attempts. Please wait ${waitMinutes} minute(s) before trying again.`,
        },
        { status: 429 }
      );
    }

    // Lookup user in PostgreSQL
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      await logAuthEvent({
        action: "FAILED_LOGIN",
        ipAddress: ip,
        metadata: { reason: "USER_NOT_FOUND_OR_NO_PW" },
      });

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated. Please contact support." },
        { status: 403 }
      );
    }

    // Verify password hash
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await logAuthEvent({
        action: "FAILED_LOGIN",
        userId: user.id,
        actorId: user.id,
        ipAddress: ip,
        metadata: { reason: "INVALID_PASSWORD" },
      });

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // Create session in PostgreSQL and set opaque token in httpOnly cookie
    const userAgent = req.headers.get("user-agent") || undefined;
    await createSession({
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });

    // Record successful login audit event
    await logAuthEvent({
      action: "LOGIN",
      userId: user.id,
      actorId: user.id,
      ipAddress: ip,
      metadata: { role: user.role },
    });

    return NextResponse.json({
      success: true,
      message: "Signed in successfully.",
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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during sign in. Please try again." },
      { status: 500 }
    );
  }
}
