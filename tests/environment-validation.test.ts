import test from "node:test";
import assert from "node:assert/strict";
import { validateEnv, isProduction, isDevelopment, isTest } from "../src/lib/env";

test("Production Configuration Validation Suite", async (t) => {
  // Baseline valid production environment dictionary
  const validProductionEnv: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://crewn_user:StrongPassword123@prod-db.example.com:5432/crewn_prod?sslmode=require&schema=public",
    AUTH_SECRET: "strong_auth_secret_with_sufficient_entropy_64_bytes_long_random_string",
    STORAGE_SIGNING_SECRET: "strong_storage_secret_with_sufficient_entropy_64_bytes_long_hex_string",
    CRON_SECRET: "strong_cron_secret_32_bytes_minimum_length",
    STORAGE_PROVIDER: "s3",
    STORAGE_BUCKET: "crewn-production-storage",
    STORAGE_REGION: "ap-south-1",
    STORAGE_ACCESS_KEY_ID: "AKIAIOSFODNN7PRODKEY",
    STORAGE_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYPRODSECRETKEY",
    REDIS_URL: "rediss://default:StrongRedisAuthToken@prod-redis.example.com:6379",
    RAZORPAY_KEY_ID: "rzp_live_realMerchantKey99",
    RAZORPAY_KEY_SECRET: "realMerchantSecretKey99",
    RAZORPAY_WEBHOOK_SECRET: "realWebhookSecretKey99",
    NEXT_PUBLIC_APP_URL: "https://crewn.com",
    APP_URL: "https://crewn.com",
    RESEND_API_KEY: "re_live_realResendApiKey99",
    EMAIL_FROM: "Crewn Platform <no-reply@crewn.com>",
  };

  // 1. Valid Production Environment passes validation
  await t.test("1. Valid production configuration passes validation without errors", () => {
    const parsed = validateEnv(validProductionEnv, { isBuild: false });
    assert.equal(parsed.NODE_ENV, "production");
    assert.equal(parsed.STORAGE_PROVIDER, "s3");
    assert.equal(parsed.NEXT_PUBLIC_APP_URL, "https://crewn.com");
  });

  // 2. Missing production secrets fail fast
  await t.test("2. Missing production secrets fail fast with descriptive errors", () => {
    const invalidEnv = { ...validProductionEnv };
    delete (invalidEnv as any).STORAGE_SIGNING_SECRET;
    delete (invalidEnv as any).CRON_SECRET;
    delete (invalidEnv as any).REDIS_URL;

    assert.throws(
      () => validateEnv(invalidEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /STORAGE_SIGNING_SECRET must be configured/);
        assert.match(err.message, /CRON_SECRET must be configured/);
        assert.match(err.message, /REDIS_URL or UPSTASH_REDIS_REST_URL must be configured/);
        return true;
      }
    );
  });

  // 3. Localhost database rejected in production
  await t.test("3. Localhost database rejected in production", () => {
    const localDbEnv = {
      ...validProductionEnv,
      DATABASE_URL: "postgresql://postgres:password@localhost:5432/crewn_db?sslmode=require",
    };

    assert.throws(
      () => validateEnv(localDbEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /DATABASE_URL must not point to localhost in production/);
        return true;
      }
    );
  });

  // 4. Missing SSL in DATABASE_URL rejected in production
  await t.test("4. Missing SSL in DATABASE_URL rejected in production", () => {
    const noSslDbEnv = {
      ...validProductionEnv,
      DATABASE_URL: "postgresql://user:pwd@prod-db.example.com:5432/crewn_prod",
      DATABASE_SSL: undefined,
    };

    assert.throws(
      () => validateEnv(noSslDbEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /DATABASE_URL must enforce SSL in production/);
        return true;
      }
    );
  });

  // 5. Insecure / short secrets rejected in production
  await t.test("5. Insecure short secrets rejected in production", () => {
    const shortSecretEnv = {
      ...validProductionEnv,
      AUTH_SECRET: "intermediate_auth_20",
      STORAGE_SIGNING_SECRET: "short-storage",
      CRON_SECRET: "short",
    };

    assert.throws(
      () => validateEnv(shortSecretEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /AUTH_SECRET must be at least 32 characters/);
        assert.match(err.message, /STORAGE_SIGNING_SECRET must be configured with minimum 32 characters/);
        assert.match(err.message, /CRON_SECRET must be configured with minimum 16 characters/);
        return true;
      }
    );
  });

  // 6. Placeholder credentials strictly rejected in production
  await t.test("6. Placeholder credentials rejected in production", () => {
    const placeholderEnv = {
      ...validProductionEnv,
      RAZORPAY_KEY_ID: "rzp_test_placeholder",
      RAZORPAY_KEY_SECRET: "placeholder_secret_value",
      RAZORPAY_WEBHOOK_SECRET: "placeholder_webhook",
      RESEND_API_KEY: "re_staging_placeholder_key",
    };

    assert.throws(
      () => validateEnv(placeholderEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /RAZORPAY_KEY_ID must not use placeholder credentials/);
        assert.match(err.message, /RAZORPAY_KEY_SECRET must not use placeholder credentials/);
        assert.match(err.message, /RAZORPAY_WEBHOOK_SECRET must not use placeholder credentials/);
        assert.match(err.message, /RESEND_API_KEY must be a valid Resend API key/);
        return true;
      }
    );
  });

  // 7. Local storage provider forbidden in production
  await t.test("7. Local storage provider forbidden in production", () => {
    const localStoreEnv = {
      ...validProductionEnv,
      STORAGE_PROVIDER: "local",
    };

    assert.throws(
      () => validateEnv(localStoreEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /STORAGE_PROVIDER='local' is forbidden in production/);
        return true;
      }
    );
  });

  // 8. Localhost APP_URL rejected in production
  await t.test("8. Localhost NEXT_PUBLIC_APP_URL rejected in production", () => {
    const localAppEnv = {
      ...validProductionEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };

    assert.throws(
      () => validateEnv(localAppEnv, { isBuild: false }),
      (err: Error) => {
        assert.match(err.message, /NEXT_PUBLIC_APP_URL must point to an HTTPS production domain/);
        return true;
      }
    );
  });

  // 9. Error messages never reveal secret values
  await t.test("9. Secret values never appear in validation error messages", () => {
    const secretLeakingTestEnv = {
      ...validProductionEnv,
      RAZORPAY_KEY_ID: "rzp_test_placeholder_SUPER_SECRET_PAYMENT_KEY_12345",
      AUTH_SECRET: "short-placeholder-SECRET_VALUE_99999",
    };

    try {
      validateEnv(secretLeakingTestEnv, { isBuild: false });
      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert.equal(err.message.includes("SUPER_SECRET_PAYMENT_KEY_12345"), false, "Secret must not appear in error");
      assert.equal(err.message.includes("SECRET_VALUE_99999"), false, "Secret must not appear in error");
    }
  });

  // 10. Development mode compatibility (does not throw on missing production services)
  await t.test("10. Development mode allows local storage and optional services", () => {
    const devEnv = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:password@localhost:5432/crewn_dev",
      AUTH_SECRET: "dev_auth_secret_minimum_16_chars",
      STORAGE_PROVIDER: "local",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    };

    const parsed = validateEnv(devEnv);
    assert.equal(parsed.NODE_ENV, "development");
    assert.equal(parsed.STORAGE_PROVIDER, "local");
    assert.equal(parsed.NEXT_PUBLIC_APP_URL, "http://localhost:3000");
  });

  // 11. Build phase allows building without live production secrets
  await t.test("11. Build phase allows execution without production runtime secrets", () => {
    const buildEnv = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://fake:fake@placeholder:5432/fake?sslmode=require",
      AUTH_SECRET: "build_dummy_auth_secret_16_chars",
      NEXT_PUBLIC_APP_URL: "https://crewn.com",
    };

    const parsed = validateEnv(buildEnv, { isBuild: true });
    assert.equal(parsed.NODE_ENV, "production");
  });

  // 12. Helper environment predicates work accurately
  await t.test("12. Environment helper predicates evaluate correctly", () => {
    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      assert.equal(isProduction(), true);
      assert.equal(isDevelopment(), false);

      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      assert.equal(isProduction(), false);
      assert.equal(isDevelopment(), true);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
    }
  });
});
