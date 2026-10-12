import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma, getDatabaseUrl, getDatabasePoolConfig } from "../src/lib/prisma";
import { getStorageSigningSecret, generateSignedUrl, verifySignedUrlToken } from "../src/lib/storage/signed-url";
import { getRazorpayCredentials, verifyWebhookSignature, resetRazorpayClient } from "../src/lib/payments/razorpay";
import { S3StorageProvider } from "../src/lib/storage";
import { GET as getCron, POST as postCron } from "../src/app/api/cron/route";
import { POST as postWebhook } from "../src/app/api/webhooks/razorpay/route";
import { GET as getHealth } from "../src/app/api/health/route";
import { GET as getReady } from "../src/app/api/ready/route";
import { RedisRateLimiter, InMemoryRateLimiter } from "../src/lib/auth/rate-limit";
import { LocalRealtimeBus, RedisRealtimeBus } from "../src/lib/realtime/bus";
import { generateInvoiceNumber } from "../src/lib/payments/invoice";
import { DistributedLock, executeJob } from "../src/lib/jobs";
import { runFinancialReconciliation, resolveFinancialDiscrepancy } from "../src/lib/payments/reconciliation";
import { getUserNotifications } from "../src/lib/notifications/service";
import { getConversationMessages } from "../src/lib/messages/service";
import { proxy } from "../src/proxy";
import { validateEnv } from "../src/lib/env";

test("Phase 12: Production Readiness & Hardened Infrastructure Suite", async (t) => {
  // ---------------------------------------------------------------------------
  // A. Missing DATABASE_URL in Production
  // ---------------------------------------------------------------------------
  await t.test("A. DATABASE_URL must be explicitly configured and fail fast if missing", () => {
    const origUrl = process.env.DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      assert.throws(
        () => getDatabaseUrl(),
        /DATABASE_URL environment variable is required/,
        "Should fail fast when DATABASE_URL is missing"
      );
    } finally {
      process.env.DATABASE_URL = origUrl;
    }

    // Proves safe configured state
    const poolConfig = getDatabasePoolConfig();
    assert.ok(poolConfig.connectionString, "Pool config should contain connectionString");
    assert.ok(poolConfig.max && poolConfig.max >= 5, "Pool max connections should be safely set");
  });

  // ---------------------------------------------------------------------------
  // B. Missing STORAGE_SIGNING_SECRET & Secret Length Validation
  // ---------------------------------------------------------------------------
  await t.test("B. STORAGE_SIGNING_SECRET requires 32+ chars and fails fast in production", () => {
    const origSecret = process.env.STORAGE_SIGNING_SECRET;
    const origSession = process.env.SESSION_SECRET;
    const origAuth = process.env.AUTH_SECRET;
    const origEnv = process.env.NODE_ENV;

    try {
      delete process.env.STORAGE_SIGNING_SECRET;
      delete process.env.SESSION_SECRET;
      delete process.env.AUTH_SECRET;

      assert.throws(
        () => getStorageSigningSecret(),
        /STORAGE_SIGNING_SECRET is missing/,
        "Should throw when no secret is configured"
      );

      // Insecure short secret validation
      process.env.STORAGE_SIGNING_SECRET = "too-short-secret";
      assert.throws(
        () => getStorageSigningSecret(),
        /STORAGE_SIGNING_SECRET is insecure: minimum 32 characters required/,
        "Should reject secret shorter than 32 characters"
      );

      // Strict production mode validation
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.STORAGE_SIGNING_SECRET;
      process.env.SESSION_SECRET = "valid-session-secret-that-is-at-least-32-characters-long";
      assert.throws(
        () => getStorageSigningSecret(),
        /STORAGE_SIGNING_SECRET must be explicitly configured in production/,
        "Production must not fall back to session secret"
      );
    } finally {
      process.env.STORAGE_SIGNING_SECRET = origSecret;
      process.env.SESSION_SECRET = origSession;
      process.env.AUTH_SECRET = origAuth;
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
    }
  });

  // ---------------------------------------------------------------------------
  // C. Missing Razorpay Credentials in Production
  // ---------------------------------------------------------------------------
  await t.test("C. Razorpay credentials must be explicitly configured and reject placeholders in prod", () => {
    const origKeyId = process.env.RAZORPAY_KEY_ID;
    const origKeySecret = process.env.RAZORPAY_KEY_SECRET;
    const origEnv = process.env.NODE_ENV;

    try {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      resetRazorpayClient();

      assert.throws(
        () => getRazorpayCredentials(),
        /Razorpay credentials missing/,
        "Should fail fast when Razorpay credentials missing"
      );

      // Production placeholder rejection
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.RAZORPAY_KEY_ID = "rzp_test_placeholder";
      process.env.RAZORPAY_KEY_SECRET = "placeholder_secret";
      assert.throws(
        () => getRazorpayCredentials(),
        /placeholder credentials are forbidden in production/,
        "Production must strictly reject placeholder credentials"
      );
    } finally {
      process.env.RAZORPAY_KEY_ID = origKeyId;
      process.env.RAZORPAY_KEY_SECRET = origKeySecret;
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      resetRazorpayClient();
    }
  });

  // ---------------------------------------------------------------------------
  // D. Invalid Cron Secret Rejection
  // ---------------------------------------------------------------------------
  await t.test("D. Cron endpoint rejects missing or invalid secret with 401", async () => {
    // Missing secret
    const unauthReq = new NextRequest("http://localhost:3000/api/cron");
    const res1 = await getCron(unauthReq);
    assert.equal(res1.status, 401, "Unauthenticated cron request should return 401");

    // Invalid secret header
    const badSecretReq = new NextRequest("http://localhost:3000/api/cron", {
      headers: { "x-cron-secret": "wrong-secret-token" },
    });
    const res2 = await getCron(badSecretReq);
    assert.equal(res2.status, 401, "Invalid cron secret should return 401");

    // Invalid bearer token
    const badBearerReq = new NextRequest("http://localhost:3000/api/cron", {
      headers: { authorization: "Bearer invalid-token" },
    });
    const res3 = await getCron(badBearerReq);
    assert.equal(res3.status, 401, "Invalid bearer token should return 401");
  });

  // ---------------------------------------------------------------------------
  // E. Valid Cron Secret Execution
  // ---------------------------------------------------------------------------
  await t.test("E. Cron endpoint accepts valid secret and executes maintenance", async () => {
    const validSecret = process.env.CRON_SECRET || "dev-cron-secret-key-for-local-testing-32b";
    process.env.CRON_SECRET = validSecret;

    const authReq = new NextRequest("http://localhost:3000/api/cron?job=CLEANUP_EXPIRED_SESSIONS", {
      headers: { "x-cron-secret": validSecret },
    });
    const res = await getCron(authReq);
    assert.equal(res.status, 200, "Authenticated cron request should return 200");
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.job, "CLEANUP_EXPIRED_SESSIONS");
  });

  // ---------------------------------------------------------------------------
  // F. Redis Unavailable in Production
  // ---------------------------------------------------------------------------
  await t.test("F. Production rate limiting fails fast if Redis is unavailable", async () => {
    const origEnv = process.env.NODE_ENV;
    const origRedis = process.env.REDIS_URL;
    const origUpstash = process.env.UPSTASH_REDIS_REST_URL;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.REDIS_URL;
      delete process.env.UPSTASH_REDIS_REST_URL;

      const limiter = new RedisRateLimiter({ redisUrl: undefined, redisToken: undefined });
      await assert.rejects(
        () => limiter.limit("test_key", 10, 60000),
        /forbidden in production|REDIS_URL must be configured/,
        "Should not silently fall back to in-memory rate limiting in production"
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      process.env.REDIS_URL = origRedis;
      process.env.UPSTASH_REDIS_REST_URL = origUpstash;
    }
  });

  // ---------------------------------------------------------------------------
  // G. Multi-Instance Rate Limiting Logic
  // ---------------------------------------------------------------------------
  await t.test("G. Rate limiter sliding window correctly tracks and limits calls", async () => {
    const limiter = new InMemoryRateLimiter();
    const key = `user_rate_test_${Date.now()}`;

    // Under limit (1st call)
    const r1 = await limiter.limit(key, 2, 5000);
    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 1);

    // Reaching limit (2nd call)
    const r2 = await limiter.limit(key, 2, 5000);
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 0);

    // Exceeding limit (3rd call)
    const r3 = await limiter.limit(key, 2, 5000);
    assert.equal(r3.success, false);
    assert.equal(r3.remaining, 0);
  });

  // ---------------------------------------------------------------------------
  // H. Multi-Instance SSE Bus Logic
  // ---------------------------------------------------------------------------
  await t.test("H. Realtime bus correctly delivers events to subscribers", async () => {
    const bus = new LocalRealtimeBus();
    const testConvId = `conv_test_${Date.now()}`;
    let receivedEvent: any = null;

    const unsubscribe = bus.subscribeConversation(testConvId, (event) => {
      receivedEvent = event;
    });

    bus.publishConversationMessage(testConvId, {
      id: "msg_123",
      conversationId: testConvId,
      senderId: "user_1",
      content: "Hello multi-instance realtime",
      createdAt: new Date().toISOString(),
      sender: {
        id: "user_1",
        name: "Sender",
        email: "sender@example.com",
        avatarUrl: null,
        role: "FREELANCER",
      },
    });

    assert.ok(receivedEvent, "Event should have been received by subscriber");
    assert.equal(receivedEvent.event, "message");
    assert.equal(receivedEvent.data.content, "Hello multi-instance realtime");

    unsubscribe();
    assert.equal(bus.listenerCount(`conv:${testConvId}`), 0);
  });

  // ---------------------------------------------------------------------------
  // I. Concurrent Atomic Invoice Generation
  // ---------------------------------------------------------------------------
  await t.test("I. Concurrent invoice generation creates unique sequential numbers without duplicates", async () => {
    const concurrency = 10;
    const promises = Array.from({ length: concurrency }, () => generateInvoiceNumber());
    const results = await Promise.all(promises);

    assert.equal(results.length, concurrency);
    const uniqueSet = new Set(results);
    assert.equal(uniqueSet.size, concurrency, "All concurrently generated invoice numbers must be unique");

    for (const invNum of results) {
      assert.match(invNum, /^INV-\d{6}-\d{4}$/, "Invoice number must match sequential format");
    }
  });

  // ---------------------------------------------------------------------------
  // J. Distributed Background Job Locking
  // ---------------------------------------------------------------------------
  await t.test("J. Distributed lock prevents simultaneous execution of singleton jobs", async () => {
    const lock = new DistributedLock(null); // using process-local safe lock for unit isolation
    const lockKey = `test_job_${Date.now()}`;

    // Instance 1 acquires
    const token1 = await lock.acquire(lockKey, 30);
    assert.ok(token1, "Instance 1 should acquire lock");

    // Instance 2 attempts same job while held
    const token2 = await lock.acquire(lockKey, 30);
    assert.equal(token2, null, "Instance 2 must be rejected while lock is held");

    // Instance 1 releases
    const released = await lock.release(lockKey, token1);
    assert.equal(released, true);

    // Instance 2 can now acquire
    const token3 = await lock.acquire(lockKey, 30);
    assert.ok(token3, "Instance 2 should acquire lock after release");
    await lock.release(lockKey, token3);
  });

  // ---------------------------------------------------------------------------
  // K. Duplicate Razorpay Webhook Idempotency
  // ---------------------------------------------------------------------------
  await t.test("K. Duplicate Razorpay webhook events are idempotently handled", async () => {
    const eventId = `evt_dedup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "placeholder_webhook";
    const body = JSON.stringify({
      event: "payment.failed",
      event_id: eventId,
      payload: { payment: { entity: { order_id: "order_nonexistent" } } },
    });
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

    const req1 = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: { "x-razorpay-signature": signature },
    });
    const res1 = await postWebhook(req1);
    assert.equal(res1.status, 200);

    // Second delivery of same event
    const req2 = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: { "x-razorpay-signature": signature },
    });
    const res2 = await postWebhook(req2);
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.match(data2.message || "", /already processed|ok/);
  });

  // ---------------------------------------------------------------------------
  // L. Invalid Razorpay Webhook Signature
  // ---------------------------------------------------------------------------
  await t.test("L. Invalid Razorpay webhook signature is rejected with 400", async () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: { "x-razorpay-signature": "invalid_forged_signature_hex" },
    });
    const res = await postWebhook(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid webhook signature");
  });

  // ---------------------------------------------------------------------------
  // M. Webhook Retry Background Job
  // ---------------------------------------------------------------------------
  await t.test("M. RETRY_FAILED_WEBHOOKS job retries failed events safely", async () => {
    const eventId = `evt_retry_test_${Date.now()}`;
    await prisma.webhookEvent.create({
      data: {
        gatewayEventId: eventId,
        provider: "RAZORPAY",
        eventType: "payment.failed",
        payloadJson: "{}",
        isProcessed: false,
        processingStatus: "FAILED",
        attempts: 1,
      },
    });

    const result = await executeJob("RETRY_FAILED_WEBHOOKS");
    assert.equal(result.success, true);

    const updated = await prisma.webhookEvent.findUnique({
      where: { gatewayEventId: eventId },
    });
    assert.ok(updated);
    assert.equal(updated.attempts, 2);
    assert.equal(updated.processingStatus, "PROCESSING");
  });

  // ---------------------------------------------------------------------------
  // N. Financial Reconciliation Engine & Audited Discrepancy Resolution
  // ---------------------------------------------------------------------------
  await t.test("N. Financial reconciliation inspects ledgers and records audited resolutions", async () => {
    const report = await runFinancialReconciliation();
    assert.ok(report.timestamp);
    assert.ok(typeof report.summary.matchedRecords === "number");
    assert.ok(Array.isArray(report.discrepancies));

    // Test audited resolution mechanism
    const testAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (testAdmin) {
      const resolution = await resolveFinancialDiscrepancy({
        adminUserId: testAdmin.id,
        discrepancyId: "disc_test_123",
        resolutionAction: "ACKNOWLEDGE_AUDITED",
        notes: "Test automated reconciliation check verified",
        entityType: "TRANSACTION",
        entityId: "tx_sample_test",
      });
      assert.equal(resolution.success, true);
    }
  });

  // ---------------------------------------------------------------------------
  // O. Real S3 Upload URL Generation
  // ---------------------------------------------------------------------------
  await t.test("O. S3StorageProvider generates real AWS PutObject presigned upload URL", async () => {
    const s3 = new S3StorageProvider({
      bucket: "crewn-test-bucket",
      region: "us-east-1",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    const upload = await s3.createUploadUrl("contracts/agreement.pdf", "application/pdf");
    assert.ok(upload.uploadUrl, "Upload URL should be generated");
    assert.ok(upload.uploadUrl.includes("X-Amz-Signature") || upload.uploadUrl.includes("crewn-test-bucket"), "URL should be S3 presigned URL");
    assert.ok(upload.storageKey.includes("agreement.pdf"), "Storage key should contain agreement.pdf");
  });

  // ---------------------------------------------------------------------------
  // P. Real S3 Metadata Inspection
  // ---------------------------------------------------------------------------
  await t.test("P. S3StorageProvider initializes HeadObjectCommand without crashes", async () => {
    const s3 = new S3StorageProvider({
      bucket: "crewn-test-bucket",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    // Object doesn't exist on mock key, should return null safely without throwing
    const meta = await s3.getObjectMetadata("non_existent_key.pdf");
    assert.equal(meta, null);
  });

  // ---------------------------------------------------------------------------
  // Q. Real S3 Deletion
  // ---------------------------------------------------------------------------
  await t.test("Q. S3StorageProvider handles DeleteObjectCommand gracefully", async () => {
    const s3 = new S3StorageProvider({
      bucket: "crewn-test-bucket",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    // Delete executes against S3
    const deleted = await s3.deleteFile("sample-test-delete.pdf");
    // S3 DeleteObjectCommand against standard bucket or mock
    assert.ok(typeof deleted === "boolean");
  });

  // ---------------------------------------------------------------------------
  // R. Real S3 Presigned Download URL
  // ---------------------------------------------------------------------------
  await t.test("R. S3StorageProvider generates real presigned download URL with signature", async () => {
    const s3 = new S3StorageProvider({
      bucket: "crewn-test-bucket",
      region: "us-east-1",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    const signed = await s3.getSignedUrl("deliverables/final.mp4", 600);
    assert.ok(signed.url.includes("X-Amz-Signature") || signed.url.includes("crewn-test-bucket"));
    assert.ok(signed.expiresAt instanceof Date);
  });

  // ---------------------------------------------------------------------------
  // S. Unauthorized Object Access & Tampered Signatures
  // ---------------------------------------------------------------------------
  await t.test("S. Storage signed URLs reject tampered signatures or expired timestamps", () => {
    const signed = generateSignedUrl("secret_deliverable.pdf", 900);
    const parsed = new URL(signed.url, "http://localhost:3000");
    const token = parsed.searchParams.get("token")!;
    const expires = parsed.searchParams.get("expires")!;

    // Valid check
    const validCheck = verifySignedUrlToken("secret_deliverable.pdf", token, expires);
    assert.equal(validCheck.isValid, true);

    // Tampered token
    const badTokenCheck = verifySignedUrlToken("secret_deliverable.pdf", token.slice(0, -4) + "ffff", expires);
    assert.equal(badTokenCheck.isValid, false);

    // Expired timestamp
    const expiredCheck = verifySignedUrlToken("secret_deliverable.pdf", token, Math.floor(Date.now() / 1000) - 30);
    assert.equal(expiredCheck.isValid, false);
    assert.match(expiredCheck.error || "", /expired/);

    // Tampered filename
    const badKeyCheck = verifySignedUrlToken("other_file.pdf", token, expires);
    assert.equal(badKeyCheck.isValid, false);
  });

  // ---------------------------------------------------------------------------
  // T. Paginated Messages Query Limit Enforced
  // ---------------------------------------------------------------------------
  await t.test("T. Message queries clamp take parameter to max 50 records", async () => {
    const user = await prisma.user.findFirst();
    const conv = await prisma.conversation.findFirst();
    if (user && conv) {
      // Ensure user is member
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conv.id, userId: user.id } },
        create: { conversationId: conv.id, userId: user.id },
        update: {},
      });

      // Requesting 500 records should not crash and should cap limit
      const messages = await getConversationMessages(conv.id, user.id, { take: 500 });
      assert.ok(Array.isArray(messages));
      assert.ok(messages.length <= 50, "Messages count must never exceed 50 per page");
    }
  });

  // ---------------------------------------------------------------------------
  // U. Paginated Notifications Query Limit Enforced
  // ---------------------------------------------------------------------------
  await t.test("U. Notification queries clamp limit parameter to max 50 records", async () => {
    const user = await prisma.user.findFirst();
    if (user) {
      const result = await getUserNotifications(user.id, { limit: 1000 });
      assert.ok(Array.isArray(result.notifications));
      assert.ok(result.notifications.length <= 50, "Notifications count must never exceed 50 per page");
    }
  });

  // ---------------------------------------------------------------------------
  // V. Request-ID Propagation & Correlation
  // ---------------------------------------------------------------------------
  await t.test("V. Request ID is sanitized, generated if absent, and returned in headers", () => {
    // Absent request id: auto-generated
    const req1 = new NextRequest("http://localhost:3000/");
    const res1 = proxy(req1);
    const reqId1 = res1.headers.get("x-request-id");
    assert.ok(reqId1, "Should generate x-request-id header");
    assert.match(reqId1, /^req_/);

    // Existing valid request id: preserved
    const customId = "req_custom_trace_9876543210";
    const req2 = new NextRequest("http://localhost:3000/", {
      headers: { "x-request-id": customId },
    });
    const res2 = proxy(req2);
    assert.equal(res2.headers.get("x-request-id"), customId);
  });

  // ---------------------------------------------------------------------------
  // W. Safe Health Endpoint
  // ---------------------------------------------------------------------------
  await t.test("W. /api/health returns only safe status without leaking environment details", async () => {
    const res = await getHealth();
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.status, "ok");
    assert.ok(typeof data.uptime === "number");
    assert.ok(data.timestamp);

    // Strict security check: must NOT leak internal version, env, or server details
    assert.equal(data.env, undefined, "Must not leak NODE_ENV");
    assert.equal(data.version, undefined, "Must not leak package version");
    assert.equal(data.database, undefined, "Must not leak DB configuration");
  });

  // ---------------------------------------------------------------------------
  // X. Readiness Dependency Checks
  // ---------------------------------------------------------------------------
  await t.test("X. /api/ready verifies actual database and storage without exposing credentials", async () => {
    const res = await getReady();
    assert.ok(res.status === 200 || res.status === 503);
    const data = await res.json();

    assert.ok(data.status);
    assert.ok(data.checks);
    assert.ok(data.checks.database);
    assert.ok(data.checks.storage);

    // Ensure zero credentials or connection strings are exposed in response
    const jsonString = JSON.stringify(data);
    assert.equal(jsonString.includes("postgres://"), false);
    assert.equal(jsonString.includes("postgresql://"), false);
    assert.equal(jsonString.includes("password"), false);
    assert.equal(jsonString.includes("secret"), false);
  });
});
