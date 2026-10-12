export interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<boolean>;
  sendPasswordResetEmail(email: string, token: string): Promise<boolean>;
}

import crypto from "crypto";
import { logger } from "@/lib/logger";

// Idempotency tracking cache: prevents duplicate emails within 5 minutes
const sentEmailIdempotencyCache = new Map<string, number>();

export function isDuplicateEmail(idempotencyKey: string): boolean {
  const now = Date.now();
  const existing = sentEmailIdempotencyCache.get(idempotencyKey);
  if (existing && existing > now) {
    return true;
  }
  sentEmailIdempotencyCache.set(idempotencyKey, now + 5 * 60 * 1000);
  return false;
}

export function resetEmailIdempotencyCache(): void {
  sentEmailIdempotencyCache.clear();
}

function getBaseAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_APP_URL or APP_URL environment variable is required in production for transactional email link generation."
      );
    }
    return "http://localhost:3000";
  }
  return url.replace(/\/$/, "");
}

class ConsoleEmailService implements EmailService {
  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`verify:${email}:${token}`)
      .digest("hex");

    if (isDuplicateEmail(idempotencyKey)) {
      logger.info({
        category: "COMMUNICATION",
        message: "Duplicate verification email suppressed via idempotency key",
      });
      return true;
    }

    const appUrl = getBaseAppUrl();
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    console.log(`\n======================================================`);
    console.log(`📧 [EMAIL SERVICE - CONSOLE] Verification Email`);
    console.log(`To: ${email}`);
    console.log(`Action: Confirm your Crewn account`);
    console.log(`Link: ${verificationUrl}`);
    console.log(`======================================================\n`);

    return true;
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`reset:${email}:${token}`)
      .digest("hex");

    if (isDuplicateEmail(idempotencyKey)) {
      logger.info({
        category: "COMMUNICATION",
        message: "Duplicate password reset email suppressed via idempotency key",
      });
      return true;
    }

    const appUrl = getBaseAppUrl();
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    console.log(`\n======================================================`);
    console.log(`🔑 [EMAIL SERVICE - CONSOLE] Password Reset Request`);
    console.log(`To: ${email}`);
    console.log(`Action: Reset your Crewn password`);
    console.log(`Link: ${resetUrl}`);
    console.log(`======================================================\n`);

    return true;
  }
}

class ResendEmailService implements EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async sendWithRetry(
    payload: Record<string, unknown>,
    idempotencyKey: string,
    maxAttempts = 3
  ): Promise<boolean> {
    if (isDuplicateEmail(idempotencyKey)) {
      logger.info({
        category: "COMMUNICATION",
        message: "Duplicate transactional email suppressed via idempotency key",
      });
      return true;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          return true;
        }

        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 100;
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }

        return false;
      } catch {
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 100;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return false;
      }
    }

    return false;
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const appUrl = getBaseAppUrl();
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`verify:${email}:${token}`)
      .digest("hex");

    return this.sendWithRetry(
      {
        from: "Crewn Platform <no-reply@crewn.com>",
        to: [email],
        subject: "Verify your email on Crewn",
        html: `<p>Welcome to Crewn. Click here to verify your account: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
      },
      idempotencyKey
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const appUrl = getBaseAppUrl();
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`reset:${email}:${token}`)
      .digest("hex");

    return this.sendWithRetry(
      {
        from: "Crewn Platform <security@crewn.com>",
        to: [email],
        subject: "Reset your Crewn password",
        html: `<p>A password reset was requested. Click here to set a new password: <a href="${resetUrl}">${resetUrl}</a></p>`,
      },
      idempotencyKey
    );
  }
}

let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (emailServiceInstance) return emailServiceInstance;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "re_placeholder" && resendKey.startsWith("re_")) {
    emailServiceInstance = new ResendEmailService(resendKey);
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RESEND_API_KEY environment variable is required in production. Console fallback is forbidden."
      );
    }
    emailServiceInstance = new ConsoleEmailService();
  }

  return emailServiceInstance;
}

export function resetEmailService(): void {
  emailServiceInstance = null;
}
