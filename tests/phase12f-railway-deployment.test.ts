import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { getDatabasePoolConfig } from "../src/lib/prisma";
import { validateEnv } from "../src/lib/env";
import { GET as getReady } from "../src/app/api/ready/route";
import { GET as getHealth } from "../src/app/api/health/route";

test("Phase 12f: Railway Staging Deployment Automation & Invariants Suite", async (t) => {
  // ---------------------------------------------------------------------------
  // 1. railway.json schema and command integrity
  // ---------------------------------------------------------------------------
  await t.test("1. railway.json is present and matches Railway deployment requirements", () => {
    const railwayPath = path.join(process.cwd(), "railway.json");
    assert.ok(fs.existsSync(railwayPath), "railway.json must exist in project root");

    const content = JSON.parse(fs.readFileSync(railwayPath, "utf-8"));
    assert.equal(content.$schema, "https://railway.com/railway.schema.json");
    assert.equal(content.build?.builder, "NIXPACKS");
    assert.equal(content.build?.buildCommand, "npm run build");
    assert.equal(content.deploy?.preDeployCommand, "npx prisma migrate deploy");
    assert.equal(content.deploy?.startCommand, "npm run start");
    assert.equal(content.deploy?.healthcheckPath, "/api/health");
    assert.equal(content.deploy?.healthcheckTimeout, 100);
    assert.equal(content.deploy?.restartPolicyType, "ON_FAILURE");
    assert.equal(content.deploy?.restartPolicyMaxRetries, 3);
    assert.equal(content.deploy?.drainingSeconds, 30);
  });

  // ---------------------------------------------------------------------------
  // 2. Health and readiness endpoints return non-leaking, appropriate statuses
  // ---------------------------------------------------------------------------
  await t.test("2. /api/health and /api/ready return valid payloads without sensitive data", async () => {
    // Health check
    const healthRes = await getHealth();
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, "ok");
    assert.ok(typeof healthData.uptime === "number");
    assert.ok(healthData.timestamp);
    assert.equal(healthData.env, undefined);
    assert.equal(healthData.databaseUrl, undefined);

    // Readiness check
    const readyRes = await getReady();
    assert.ok(readyRes.status === 200 || readyRes.status === 503);
    const readyData = await readyRes.json();
    assert.ok(["ready", "unready"].includes(readyData.status));
    assert.ok(readyData.checks);
    assert.ok(["ok", "failed"].includes(readyData.checks.database));
    assert.ok(["ok", "failed"].includes(readyData.checks.storage));
    assert.ok(["ok", "failed", "skipped"].includes(readyData.checks.redis));

    const stringified = JSON.stringify(readyData);
    assert.equal(stringified.includes("postgresql://"), false);
    assert.equal(stringified.includes("railway.internal"), false);
    assert.equal(stringified.includes("password"), false);
    assert.equal(stringified.includes("secret"), false);
  });

  // ---------------------------------------------------------------------------
  // 3. Database connection pool respects SSL and connection configuration
  // ---------------------------------------------------------------------------
  await t.test("3. getDatabasePoolConfig respects SSL and pool size settings", () => {
    const origMax = process.env.DATABASE_POOL_MAX;
    const origSsl = process.env.DATABASE_SSL;
    const origReject = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;

    try {
      process.env.DATABASE_POOL_MAX = "15";
      process.env.DATABASE_SSL = "true";
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = "false";

      const poolConfig = getDatabasePoolConfig();
      assert.equal(poolConfig.max, 15);
      assert.deepEqual(poolConfig.ssl, { rejectUnauthorized: false });
    } finally {
      process.env.DATABASE_POOL_MAX = origMax;
      process.env.DATABASE_SSL = origSsl;
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = origReject;
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Staging environment validation
  // ---------------------------------------------------------------------------
  await t.test("4. Staging environment configuration validates correctly with test credentials", () => {
    const validStagingEnv: Record<string, string> = {
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://postgres:randomPass@postgres.railway.internal:5432/railway?sslmode=require",
      AUTH_SECRET: "strong_auth_secret_with_sufficient_entropy_64_bytes_long_random_string",
      STORAGE_SIGNING_SECRET: "strong_storage_secret_with_sufficient_entropy_64_bytes_long_hex_string",
      CRON_SECRET: "strong_cron_secret_32_bytes_minimum_length",
      STORAGE_PROVIDER: "s3",
      STORAGE_BUCKET: "crewn-staging-storage",
      STORAGE_REGION: "ap-south-1",
      STORAGE_ACCESS_KEY_ID: "AKIAIOSFODNN7STAGING",
      STORAGE_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYSTAGINGSECRET",
      REDIS_URL: "redis://default:redisPass@redis.railway.internal:6379",
      RAZORPAY_KEY_ID: "rzp_test_stageMerchantKey99",
      RAZORPAY_KEY_SECRET: "stageMerchantSecretKey99",
      RAZORPAY_WEBHOOK_SECRET: "stageWebhookSecretKey99",
      NEXT_PUBLIC_APP_URL: "https://crewn-staging.up.railway.app",
      APP_URL: "https://crewn-staging.up.railway.app",
      RESEND_API_KEY: "re_stage_realResendApiKey99",
      EMAIL_FROM: "Crewn Staging <notifications@crewn.test>",
    };

    const parsed = validateEnv(validStagingEnv, { isBuild: false });
    assert.equal(parsed.NODE_ENV, "production");
    assert.equal(parsed.APP_ENV, "staging");
    assert.equal(parsed.RAZORPAY_KEY_ID, "rzp_test_stageMerchantKey99");
    assert.equal(parsed.STORAGE_PROVIDER, "s3");
  });

  // ---------------------------------------------------------------------------
  // 5. Insecure placeholder credentials rejected in staging/production
  // ---------------------------------------------------------------------------
  await t.test("5. Insecure placeholder credentials rejected during staging/production validation", () => {
    const placeholderEnv: Record<string, string> = {
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://postgres:pass@postgres.railway.internal:5432/railway?sslmode=require",
      AUTH_SECRET: "your-32-byte-base64-random-secret-here-min-32-chars",
      STORAGE_SIGNING_SECRET: "your-32-byte-hex-storage-signing-secret-here-min-32-chars",
      CRON_SECRET: "your-secure-cron-secret-for-scheduled-job-triggers",
      STORAGE_PROVIDER: "s3",
      STORAGE_BUCKET: "crewn-staging-storage",
      STORAGE_REGION: "ap-south-1",
      STORAGE_ACCESS_KEY_ID: "AKIAIOSFODNN7STAGING",
      STORAGE_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYSTAGINGSECRET",
      REDIS_URL: "redis://default:redisPass@redis.railway.internal:6379",
      RAZORPAY_KEY_ID: "rzp_test_your_sandbox_key_id",
      RAZORPAY_KEY_SECRET: "your_razorpay_sandbox_secret",
      RAZORPAY_WEBHOOK_SECRET: "your_razorpay_staging_webhook_secret",
      NEXT_PUBLIC_APP_URL: "https://crewn-staging.up.railway.app",
      APP_URL: "https://crewn-staging.up.railway.app",
      RESEND_API_KEY: "re_staging_placeholder_key",
      EMAIL_FROM: "Crewn Staging <notifications@crewn.test>",
    };

    assert.throws(
      () => validateEnv(placeholderEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /must not use placeholder/);
        return true;
      }
    );
  });
});
