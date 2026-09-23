import { z } from "zod";

/**
 * Server-side environment variables schema.
 * These keys must NEVER be exposed to the client bundle.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET should be at least 16 characters for security"),
  
  // Future integrations (optional in development, validated in production)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
});

/**
 * Client-side environment variables schema.
 * Must be prefixed with NEXT_PUBLIC_
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  STORAGE_REGION: process.env.STORAGE_REGION,
  STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
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
