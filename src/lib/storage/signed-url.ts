import crypto from "crypto";

export function getStorageSigningSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET || process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret || secret.trim() === "") {
    throw new Error(
      "STORAGE_SIGNING_SECRET is missing. A secure storage signing secret (minimum 32 characters) must be configured."
    );
  }

  if (secret.length < 32) {
    throw new Error(
      `STORAGE_SIGNING_SECRET is insecure: minimum 32 characters required, got ${secret.length} characters.`
    );
  }

  if (isProd && !process.env.STORAGE_SIGNING_SECRET) {
    throw new Error(
      "STORAGE_SIGNING_SECRET must be explicitly configured in production. Fallbacks to other secrets are forbidden in production."
    );
  }

  return secret;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

/**
 * Generates a short-lived HMAC-signed URL for private storage assets.
 * Defaults to 15 minutes (900 seconds) expiration.
 */
export function generateSignedUrl(
  key: string,
  expiresInSeconds = 900,
  baseUrl = "/api/files"
): SignedUrlResult {
  const secret = getStorageSigningSecret();
  const expiresTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${key}:${expiresTimestamp}`;
  const token = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const url = `${baseUrl}/${encodeURIComponent(key)}?token=${token}&expires=${expiresTimestamp}`;
  return {
    url,
    expiresAt: new Date(expiresTimestamp * 1000),
  };
}

/**
 * Verifies that a signed URL has a valid HMAC token and has not expired.
 * Timing-safe comparison prevents side-channel token enumeration.
 */
export function verifySignedUrlToken(
  key: string,
  token: string,
  expires: string | number
): { isValid: boolean; error?: string } {
  if (!token || !expires) {
    return { isValid: false, error: "Missing signature token or expiration timestamp" };
  }

  if (typeof expires === "string" && !/^\d+$/.test(expires.trim())) {
    return { isValid: false, error: "Invalid expiration format" };
  }
  const expNum = typeof expires === "string" ? parseInt(expires.trim(), 10) : expires;

  const currentSeconds = Math.floor(Date.now() / 1000);
  if (currentSeconds > expNum) {
    return { isValid: false, error: "Signed URL has expired" };
  }

  let secret: string;
  try {
    secret = getStorageSigningSecret();
  } catch (err) {
    return { isValid: false, error: (err as Error).message };
  }

  const payload = `${key}:${expNum}`;
  const expectedToken = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return { isValid: false, error: "Invalid signature length" };
  }

  const matches = crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  if (!matches) {
    return { isValid: false, error: "Signature verification failed" };
  }

  return { isValid: true };
}
