import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "@/lib/env";

let razorpayClient: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.warn("⚠️ Razorpay credentials are not set in environment. Running in sandbox initialization mode.");
    }

    razorpayClient = new Razorpay({
      key_id: keyId || "rzp_test_placeholder",
      key_secret: keySecret || "placeholder_secret",
    });
  }
  return razorpayClient;
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
  const secret = params.secret || env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  if (!secret) return false;

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
    env.RAZORPAY_WEBHOOK_SECRET ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    "";
  if (!webhookSecret) return false;

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
