import "dotenv/config";
import { z } from "zod";

/**
 * Server-side environment variables schema.
 * These keys must NEVER be exposed to the client bundle.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).optional(),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET should be at least 16 characters for security"),
  APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
  STORAGE_SIGNING_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Payment credentials
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Redis & Rate limiting
  REDIS_URL: z.string().optional(),
  REDIS_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(["local", "s3", "r2"]).default("local"),
  STORAGE_DRIVER: z.enum(["local", "s3", "r2"]).default("local"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT: z.string().optional(),
  STORAGE_CDN_URL: z.string().optional(),
  STORAGE_LOCAL_DIR: z.string().optional(),

  // Operational & Networking
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().optional(),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().optional(),
  DATABASE_POOL_CONNECTION_TIMEOUT: z.coerce.number().optional(),
  DATABASE_SSL: z.string().optional(),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.string().optional(),
});

/**
 * Client-side environment variables schema.
 * Must be prefixed with NEXT_PUBLIC_
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
});

function getProcessEnv(override?: Record<string, string | undefined>) {
  const envSource = override || process.env;
  return {
    NODE_ENV: envSource.NODE_ENV,
    APP_ENV: envSource.APP_ENV,
    DATABASE_URL: envSource.DATABASE_URL,
    AUTH_SECRET: envSource.AUTH_SECRET,
    APP_URL: envSource.APP_URL,
    CRON_SECRET: envSource.CRON_SECRET,
    STORAGE_SIGNING_SECRET: envSource.STORAGE_SIGNING_SECRET,
    LOG_LEVEL: envSource.LOG_LEVEL || "info",
    RAZORPAY_KEY_ID: envSource.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: envSource.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: envSource.RAZORPAY_WEBHOOK_SECRET,
    OPENAI_API_KEY: envSource.OPENAI_API_KEY,
    RESEND_API_KEY: envSource.RESEND_API_KEY,
    EMAIL_FROM: envSource.EMAIL_FROM,
    REDIS_URL: envSource.REDIS_URL,
    REDIS_TOKEN: envSource.REDIS_TOKEN,
    UPSTASH_REDIS_REST_URL: envSource.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: envSource.UPSTASH_REDIS_REST_TOKEN,
    STORAGE_PROVIDER: envSource.STORAGE_PROVIDER || envSource.STORAGE_DRIVER || "local",
    STORAGE_DRIVER: envSource.STORAGE_PROVIDER || envSource.STORAGE_DRIVER || "local",
    STORAGE_ENDPOINT: envSource.STORAGE_ENDPOINT || envSource.AWS_ENDPOINT,
    STORAGE_BUCKET: envSource.STORAGE_BUCKET || envSource.AWS_S3_BUCKET,
    STORAGE_REGION: envSource.STORAGE_REGION || envSource.AWS_REGION,
    STORAGE_ACCESS_KEY_ID: envSource.STORAGE_ACCESS_KEY_ID || envSource.AWS_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY: envSource.STORAGE_SECRET_ACCESS_KEY || envSource.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: envSource.AWS_S3_BUCKET || envSource.STORAGE_BUCKET,
    AWS_REGION: envSource.AWS_REGION || envSource.STORAGE_REGION,
    AWS_ACCESS_KEY_ID: envSource.AWS_ACCESS_KEY_ID || envSource.STORAGE_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: envSource.AWS_SECRET_ACCESS_KEY || envSource.STORAGE_SECRET_ACCESS_KEY,
    AWS_ENDPOINT: envSource.AWS_ENDPOINT || envSource.STORAGE_ENDPOINT,
    STORAGE_CDN_URL: envSource.STORAGE_CDN_URL || envSource.STORAGE_PUBLIC_URL,
    STORAGE_LOCAL_DIR: envSource.STORAGE_LOCAL_DIR,
    CORS_ALLOWED_ORIGINS: envSource.CORS_ALLOWED_ORIGINS,
    DATABASE_POOL_MAX: envSource.DATABASE_POOL_MAX,
    DATABASE_POOL_IDLE_TIMEOUT: envSource.DATABASE_POOL_IDLE_TIMEOUT,
    DATABASE_POOL_CONNECTION_TIMEOUT: envSource.DATABASE_POOL_CONNECTION_TIMEOUT,
    DATABASE_SSL: envSource.DATABASE_SSL,
    DATABASE_SSL_REJECT_UNAUTHORIZED: envSource.DATABASE_SSL_REJECT_UNAUTHORIZED,
    NEXT_PUBLIC_APP_URL: envSource.NEXT_PUBLIC_APP_URL || envSource.APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: envSource.NEXT_PUBLIC_RAZORPAY_KEY_ID || envSource.RAZORPAY_KEY_ID,
  };
}

const isServer = typeof window === "undefined";

const PLACEHOLDER_PATTERNS = [
  "placeholder",
  "your-32-byte",
  "your_sandbox",
  "your_razorpay",
  "re_staging_placeholder",
  "re_placeholder",
  "dummy",
  "example.com",
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

export interface ValidateEnvOptions {
  isBuild?: boolean;
}

export function validateEnv(
  customEnv?: Record<string, string | undefined>,
  options?: ValidateEnvOptions
) {
  const currentEnv = getProcessEnv(customEnv);
  const clientParsed = clientSchema.safeParse(currentEnv);
  if (!clientParsed.success) {
    console.error("❌ Invalid client environment variables:", clientParsed.error.flatten().fieldErrors);
    throw new Error("Invalid client environment variables.");
  }

  if (isServer) {
    const serverParsed = serverSchema.safeParse(currentEnv);
    if (!serverParsed.success) {
      console.error("❌ Invalid server environment variables:", serverParsed.error.flatten().fieldErrors);
      throw new Error(`Invalid server environment variables: ${JSON.stringify(serverParsed.error.flatten().fieldErrors)}`);
    }

    const envSource = customEnv || process.env;
    const isBuild =
      options?.isBuild ??
      (envSource.NEXT_PHASE === "phase-production-build" ||
        envSource.npm_lifecycle_event === "build" ||
        process.env.NEXT_PHASE === "phase-production-build" ||
        process.env.npm_lifecycle_event === "build");

    if (serverParsed.data.NODE_ENV === "production" && !isBuild) {
      const violations: string[] = [];

      // 1. DATABASE_URL validation
      const dbUrl = serverParsed.data.DATABASE_URL;
      if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") || dbUrl.includes("::1")) {
        violations.push("DATABASE_URL must not point to localhost in production.");
      }
      const hasSslInUrl = dbUrl.includes("sslmode=require") || dbUrl.includes("sslmode=verify-full") || dbUrl.includes("sslmode=verify-ca") || dbUrl.includes("ssl=true");
      const hasSslEnv = serverParsed.data.DATABASE_SSL === "true" || serverParsed.data.DATABASE_SSL === "1";
      if (!hasSslInUrl && !hasSslEnv) {
        violations.push("DATABASE_URL must enforce SSL in production (?sslmode=require or DATABASE_SSL=true).");
      }

      // 2. AUTH_SECRET validation
      if (!serverParsed.data.AUTH_SECRET || serverParsed.data.AUTH_SECRET.length < 32) {
        violations.push("AUTH_SECRET must be at least 32 characters in production.");
      } else if (isPlaceholder(serverParsed.data.AUTH_SECRET)) {
        violations.push("AUTH_SECRET must not use placeholder values in production.");
      }

      // 3. STORAGE_SIGNING_SECRET validation
      if (!serverParsed.data.STORAGE_SIGNING_SECRET || serverParsed.data.STORAGE_SIGNING_SECRET.length < 32) {
        violations.push("STORAGE_SIGNING_SECRET must be configured with minimum 32 characters in production.");
      } else if (isPlaceholder(serverParsed.data.STORAGE_SIGNING_SECRET)) {
        violations.push("STORAGE_SIGNING_SECRET must not use placeholder values in production.");
      }

      // 4. CRON_SECRET validation
      if (!serverParsed.data.CRON_SECRET || serverParsed.data.CRON_SECRET.length < 16) {
        violations.push("CRON_SECRET must be configured with minimum 16 characters in production.");
      } else if (isPlaceholder(serverParsed.data.CRON_SECRET)) {
        violations.push("CRON_SECRET must not use placeholder values in production.");
      }

      // 5. STORAGE_PROVIDER validation
      if (serverParsed.data.STORAGE_PROVIDER === "local") {
        violations.push("STORAGE_PROVIDER='local' is forbidden in production; use 's3' or 'r2'.");
      }
      if (serverParsed.data.STORAGE_PROVIDER === "s3" || serverParsed.data.STORAGE_PROVIDER === "r2") {
        if (!serverParsed.data.STORAGE_BUCKET) {
          violations.push("STORAGE_BUCKET (or AWS_S3_BUCKET) is required when using cloud storage in production.");
        }
        if (!serverParsed.data.STORAGE_REGION) {
          violations.push("STORAGE_REGION (or AWS_REGION) is required when using cloud storage in production.");
        }
      }

      // 6. REDIS_URL validation
      const hasRedis = Boolean(serverParsed.data.REDIS_URL || serverParsed.data.UPSTASH_REDIS_REST_URL);
      if (!hasRedis) {
        violations.push("REDIS_URL or UPSTASH_REDIS_REST_URL must be configured in production for distributed locking and rate limiting.");
      } else if (serverParsed.data.REDIS_URL && (serverParsed.data.REDIS_URL.includes("localhost") || serverParsed.data.REDIS_URL.includes("127.0.0.1"))) {
        violations.push("REDIS_URL must not point to localhost in production.");
      }

      // 7. RAZORPAY credentials validation
      if (!serverParsed.data.RAZORPAY_KEY_ID) {
        violations.push("RAZORPAY_KEY_ID is required in production.");
      } else if (isPlaceholder(serverParsed.data.RAZORPAY_KEY_ID)) {
        violations.push("RAZORPAY_KEY_ID must not use placeholder credentials in production.");
      }

      if (!serverParsed.data.RAZORPAY_KEY_SECRET) {
        violations.push("RAZORPAY_KEY_SECRET is required in production.");
      } else if (isPlaceholder(serverParsed.data.RAZORPAY_KEY_SECRET)) {
        violations.push("RAZORPAY_KEY_SECRET must not use placeholder credentials in production.");
      }

      if (!serverParsed.data.RAZORPAY_WEBHOOK_SECRET) {
        violations.push("RAZORPAY_WEBHOOK_SECRET is required in production.");
      } else if (isPlaceholder(serverParsed.data.RAZORPAY_WEBHOOK_SECRET)) {
        violations.push("RAZORPAY_WEBHOOK_SECRET must not use placeholder credentials in production.");
      }

      // 8. APP_URL & NEXT_PUBLIC_APP_URL validation
      const appUrl = clientParsed.data.NEXT_PUBLIC_APP_URL;
      if (appUrl.startsWith("http://localhost") || appUrl.startsWith("http://127.0.0.1")) {
        violations.push("NEXT_PUBLIC_APP_URL must point to an HTTPS production domain and reject localhost in production.");
      } else if (!appUrl.startsWith("https://")) {
        violations.push("NEXT_PUBLIC_APP_URL must use https:// in production.");
      }

      // 9. RESEND_API_KEY validation
      if (!serverParsed.data.RESEND_API_KEY) {
        violations.push("RESEND_API_KEY is required in production for transactional email delivery.");
      } else if (!serverParsed.data.RESEND_API_KEY.startsWith("re_") || isPlaceholder(serverParsed.data.RESEND_API_KEY)) {
        violations.push("RESEND_API_KEY must be a valid Resend API key starting with 're_' and not a placeholder.");
      }

      if (violations.length > 0) {
        throw new Error(
          `Production environment configuration validation failed:\n  - ${violations.join("\n  - ")}`
        );
      }
    }

    return {
      ...serverParsed.data,
      ...clientParsed.data,
    };
  }

  return {
    ...clientParsed.data,
  } as unknown as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isStaging(): boolean {
  return process.env.APP_ENV === "staging" || process.env.VERCEL_ENV === "preview";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
}

export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

export const env = validateEnv();
