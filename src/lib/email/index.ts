export interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<boolean>;
  sendPasswordResetEmail(email: string, token: string): Promise<boolean>;
}

class ConsoleEmailService implements EmailService {
  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    console.log(`\n======================================================`);
    console.log(`📧 [EMAIL SERVICE - CONSOLE] Verification Email`);
    console.log(`To: ${email}`);
    console.log(`Action: Confirm your Crewn account`);
    console.log(`Link: ${verificationUrl}`);
    console.log(`Token: ${token}`);
    console.log(`======================================================\n`);

    return true;
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    console.log(`\n======================================================`);
    console.log(`🔑 [EMAIL SERVICE - CONSOLE] Password Reset Request`);
    console.log(`To: ${email}`);
    console.log(`Action: Reset your Crewn password`);
    console.log(`Link: ${resetUrl}`);
    console.log(`Token: ${token}`);
    console.log(`======================================================\n`);

    return true;
  }
}

class ResendEmailService implements EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Crewn Platform <no-reply@crewn.com>",
          to: [email],
          subject: "Verify your email on Crewn",
          html: `<p>Welcome to Crewn. Click here to verify your account: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
        }),
      });
      return res.ok;
    } catch (error) {
      console.error("Failed to dispatch verification email via Resend:", error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Crewn Platform <security@crewn.com>",
          to: [email],
          subject: "Reset your Crewn password",
          html: `<p>A password reset was requested. Click here to set a new password: <a href="${resetUrl}">${resetUrl}</a></p>`,
        }),
      });
      return res.ok;
    } catch (error) {
      console.error("Failed to dispatch password reset email via Resend:", error);
      return false;
    }
  }
}

let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (emailServiceInstance) return emailServiceInstance;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "re_placeholder" && resendKey.startsWith("re_")) {
    emailServiceInstance = new ResendEmailService(resendKey);
  } else {
    emailServiceInstance = new ConsoleEmailService();
  }

  return emailServiceInstance;
}
