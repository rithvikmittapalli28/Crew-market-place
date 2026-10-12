import Razorpay from "razorpay";
import crypto from "crypto";

let razorpayClient: Razorpay | null = null;

export function getRazorpayCredentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || keyId.trim() === "" || !keySecret || keySecret.trim() === "") {
    throw new Error(
      "Razorpay credentials missing: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be explicitly configured."
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (keyId.includes("placeholder") || keySecret.includes("placeholder")) {
      throw new Error(
        "Invalid production Razorpay credentials: placeholder credentials are forbidden in production."
      );
    }
  }

  return { keyId, keySecret };
}

export function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    const { keyId, keySecret } = getRazorpayCredentials();

    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayClient;
}

/**
 * Reset client cache (useful for testing configuration changes).
 */
export function resetRazorpayClient(): void {
  razorpayClient = null;
}

/**
 * Verifies the authenticity of Razorpay payment callback signature.
 * generated_signature = hmac_sha256(order_id + "|" + razorpay_payment_id, secret)
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  const secret = params.secret || process.env.RAZORPAY_KEY_SECRET || "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RAZORPAY_KEY_SECRET is required to verify payment signature in production.");
    }
    return false;
  }

  const payload = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(params.signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Verifies the authenticity of a Razorpay webhook event using the raw request body.
 * generated_signature = hmac_sha256(raw_body, webhook_secret)
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret?: string;
}): boolean {
  const webhookSecret =
    params.webhookSecret ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    "";
  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required for webhook signature verification in production.");
    }
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(params.rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(params.signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}
