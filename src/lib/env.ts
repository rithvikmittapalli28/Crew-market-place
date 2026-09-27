import { z } from "zod";

/**
 * Server-side environment variables schema.
 * These keys must NEVER be exposed to the client bundle.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET should be at least 16 characters for security"),
  APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  
  // Future integrations (optional in development, validated in production)
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
});

/**
 * Client-side environment variables schema.
 * Must be prefixed with NEXT_PUBLIC_
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  APP_URL: process.env.APP_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_TOKEN: process.env.REDIS_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || process.env.STORAGE_DRIVER || "local",
  STORAGE_DRIVER: process.env.STORAGE_PROVIDER || process.env.STORAGE_DRIVER || "local",
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT || process.env.AWS_ENDPOINT,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET || process.env.AWS_S3_BUCKET,
  STORAGE_REGION: process.env.STORAGE_REGION || process.env.AWS_REGION,
  STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || process.env.STORAGE_BUCKET,
  AWS_REGION: process.env.AWS_REGION || process.env.STORAGE_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY,
  AWS_ENDPOINT: process.env.AWS_ENDPOINT || process.env.STORAGE_ENDPOINT,
  STORAGE_CDN_URL: process.env.STORAGE_CDN_URL || process.env.STORAGE_PUBLIC_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000",
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
};

const isServer = typeof window === "undefined";

function validateEnv() {
  const clientParsed = clientSchema.safeParse(processEnv);
  if (!clientParsed.success) {
    console.error("❌ Invalid client environment variables:", clientParsed.error.flatten().fieldErrors);
    throw new Error("Invalid client environment variables.");
  }

  if (isServer) {
    const serverParsed = serverSchema.safeParse(processEnv);
    if (!serverParsed.success) {
      console.error("❌ Invalid server environment variables:", serverParsed.error.flatten().fieldErrors);
      throw new Error("Invalid server environment variables.");
    }

    if (serverParsed.data.NODE_ENV === "production") {
      if (!serverParsed.data.RAZORPAY_KEY_ID || !serverParsed.data.RAZORPAY_KEY_SECRET) {
        console.warn("⚠️ Production warning: Razorpay keys are not configured. Payment initiation will fail.");
      }
      if (!serverParsed.data.RESEND_API_KEY) {
        console.warn("⚠️ Production warning: RESEND_API_KEY is not configured. Transactional emails will fall back to console.");
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

export const env = validateEnv();
