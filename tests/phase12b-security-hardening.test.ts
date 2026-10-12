import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { validateAndSanitizeSvg } from "@/lib/storage/validation";
import { prisma } from "@/lib/prisma";
import { executeJob } from "@/lib/jobs";
import { isDuplicateEmail, resetEmailIdempotencyCache } from "@/lib/email";
import { hasAdminPermission, AdminPermission } from "@/lib/auth/admin";
import type { AuthUser } from "@/types";

test("Phase 12b: Final Security Hardening & Operational Resilience Suite", async (t) => {
  // ---------------------------------------------------------------------------
  // 1. CSP Nonce Generation & Production Policy
  // ---------------------------------------------------------------------------
  await t.test("1. CSP generates per-request nonce and enforces strict headers", () => {
    const req1 = new NextRequest("http://localhost:3000/");
    const res1 = proxy(req1);

    const csp1 = res1.headers.get("Content-Security-Policy");
    const nonce1 = res1.headers.get("x-nonce");

    assert.ok(csp1, "CSP header must be present");
    assert.ok(nonce1, "x-nonce header must be present");
    assert.match(csp1, new RegExp(`'nonce-${nonce1}'`), "CSP script-src must contain the generated nonce");

    // Check unique nonce per request
    const req2 = new NextRequest("http://localhost:3000/");
    const res2 = proxy(req2);
    const nonce2 = res2.headers.get("x-nonce");
    assert.notEqual(nonce1, nonce2, "Each request must receive a unique cryptographic nonce");

    // Standard security headers
    assert.equal(res1.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(res1.headers.get("X-Frame-Options"), "DENY");
    assert.equal(res1.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  });

  // ---------------------------------------------------------------------------
  // 2. Restrictive CORS Enforcement
  // ---------------------------------------------------------------------------
  await t.test("2. Restrictive CORS allows configured origins and blocks unauthorized cross-origin requests", () => {
    // A. Allowed origin OPTIONS preflight
    const reqAllowed = new NextRequest("http://localhost:3000/api/files/test", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    });
    const resAllowed = proxy(reqAllowed);
    assert.equal(resAllowed.status, 204, "OPTIONS preflight for allowed origin must return 204");
    assert.equal(resAllowed.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
    assert.equal(resAllowed.headers.get("Access-Control-Allow-Credentials"), "true");

    // B. Unauthorized origin OPTIONS preflight blocked
    const reqForbidden = new NextRequest("http://localhost:3000/api/projects", {
      method: "OPTIONS",
      headers: { Origin: "https://malicious-site.example.com" },
    });
    const resForbidden = proxy(reqForbidden);
    assert.equal(resForbidden.status, 403, "OPTIONS preflight from unauthorized origin must be rejected with 403");

    // C. Unauthorized cross-origin modifying request blocked
    const reqForbiddenPost = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { Origin: "https://malicious-site.example.com" },
    });
    const resForbiddenPost = proxy(reqForbiddenPost);
    assert.equal(resForbiddenPost.status, 403, "POST request from unauthorized cross-origin must be rejected with 403");

    // D. Razorpay webhook is exempted from browser CORS origin checks
    const reqWebhook = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
    });
    const resWebhook = proxy(reqWebhook);
    assert.notEqual(resWebhook.status, 403, "Razorpay webhook must not be blocked by CORS");
  });

  // ---------------------------------------------------------------------------
  // 3. SVG Sanitization & Stored XSS Prevention
  // ---------------------------------------------------------------------------
  await t.test("3. SVG sanitization detects and rejects stored XSS constructs across full content", () => {
    // A. Valid, safe SVG
    const safeSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="green"/></svg>`
    );
    const safeRes = validateAndSanitizeSvg(safeSvg);
    assert.equal(safeRes.isValid, true, "Standard safe SVG should be valid");

    // B. SVG with <script> tag
    const scriptSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('xss')</script><circle cx="50" cy="50" r="40"/></svg>`
    );
    const scriptRes = validateAndSanitizeSvg(scriptSvg);
    assert.equal(scriptRes.isValid, false, "SVG with <script> tag must be rejected");

    // C. SVG with inline event handler (onload)
    const onloadSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://attacker.com')"><rect width="50" height="50"/></svg>`
    );
    const onloadRes = validateAndSanitizeSvg(onloadSvg);
    assert.equal(onloadRes.isValid, false, "SVG with onload= attribute must be rejected");

    // D. SVG with foreignObject embedding
    const foreignSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><h1>Hello</h1></body></foreignObject></svg>`
    );
    const foreignRes = validateAndSanitizeSvg(foreignSvg);
    assert.equal(foreignRes.isValid, false, "SVG with foreignObject must be rejected");

    // E. SVG with XXE (external entity)
    const xxeSvg = Buffer.from(
      `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>`
    );
    const xxeRes = validateAndSanitizeSvg(xxeSvg);
    assert.equal(xxeRes.isValid, false, "SVG with XML entity declaration must be rejected");

    // F. Deep injection past 2048 bytes
    const padding = "<!-- safe comment -->".repeat(150); // > 3000 bytes
    const deepSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg">${padding}<text onclick="steal()">Click</text></svg>`
    );
    const deepRes = validateAndSanitizeSvg(deepSvg);
    assert.equal(deepRes.isValid, false, "Deep event handler injection past 2048 bytes must be rejected");
  });

  // ---------------------------------------------------------------------------
  // 4. Webhook Dead-Letter Queue (DLQ) Lifecycle
  // ---------------------------------------------------------------------------
  await t.test("4. Webhook events reaching max retry attempts transition to DEAD_LETTER and can be managed", async () => {
    const testEventId = `evt_dlq_test_${Date.now()}`;

    // Create a failed event at 4 attempts
    const event = await prisma.webhookEvent.create({
      data: {
        gatewayEventId: testEventId,
        provider: "RAZORPAY",
        eventType: "payment.captured",
        payloadJson: JSON.stringify({ event: "payment.captured", id: testEventId }),
        isProcessed: false,
        processingStatus: "FAILED",
        attempts: 4,
      },
    });

    try {
      // Simulate 5th retry attempt through retry job
      const retryOutcome = await executeJob("RETRY_FAILED_WEBHOOKS");
      assert.equal(retryOutcome.success, true);

      // Check event transitioned to DEAD_LETTER
      const dlqRecord = await prisma.webhookEvent.findUnique({
        where: { id: event.id },
      });
      assert.ok(dlqRecord);
      assert.equal(dlqRecord.processingStatus, "DEAD_LETTER", "Event with >= 5 attempts must move to DEAD_LETTER");
      assert.equal(dlqRecord.attempts, 5);

      // Verify DLQ recovery: manually reset to PENDING
      const resetRecord = await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "PENDING",
          attempts: 0,
        },
      });
      assert.equal(resetRecord.processingStatus, "PENDING");
      assert.equal(resetRecord.attempts, 0);
    } finally {
      await prisma.webhookEvent.deleteMany({
        where: { gatewayEventId: testEventId },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Session Cleanup Routine
  // ---------------------------------------------------------------------------
  await t.test("5. CLEANUP_EXPIRED_SESSIONS purges expired and revoked sessions while keeping active ones", async () => {
    // 1. Create a dummy test user
    const testUser = await prisma.user.create({
      data: {
        email: `session_cleanup_${Date.now()}@example.com`,
        passwordHash: "dummyhash",
        name: "Session Cleanup User",
        role: "FREELANCER",
      },
    });

    try {
      // 2. Create active session
      const activeSession = await prisma.session.create({
        data: {
          userId: testUser.id,
          tokenHash: `hash_active_${Date.now()}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // future
        },
      });

      // 3. Create expired session
      const expiredSession = await prisma.session.create({
        data: {
          userId: testUser.id,
          tokenHash: `hash_expired_${Date.now()}`,
          expiresAt: new Date(Date.now() - 60 * 1000), // past
        },
      });

      // 4. Create old revoked session (8 days ago)
      const revokedSession = await prisma.session.create({
        data: {
          userId: testUser.id,
          tokenHash: `hash_revoked_${Date.now()}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          revokedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      });

      // Execute session cleanup job
      const cleanupResult = await executeJob("CLEANUP_EXPIRED_SESSIONS");
      assert.equal(cleanupResult.success, true);

      // Verify active session still exists
      const foundActive = await prisma.session.findUnique({
        where: { id: activeSession.id },
      });
      assert.ok(foundActive, "Active session must NOT be deleted");

      // Verify expired session was purged
      const foundExpired = await prisma.session.findUnique({
        where: { id: expiredSession.id },
      });
      assert.equal(foundExpired, null, "Expired session must be purged");

      // Verify old revoked session was purged
      const foundRevoked = await prisma.session.findUnique({
        where: { id: revokedSession.id },
      });
      assert.equal(foundRevoked, null, "Old revoked session must be purged");
    } finally {
      await prisma.session.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  // ---------------------------------------------------------------------------
  // 6. S3 Lifecycle & Orphaned Upload Safety
  // ---------------------------------------------------------------------------
  await t.test("6. CLEANUP_ORPHANED_UPLOADS preserves attached and project files", async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `file_cleanup_${Date.now()}@example.com`,
        passwordHash: "dummyhash",
        name: "File Cleanup User",
        role: "FREELANCER",
      },
    });

    try {
      // A. Orphaned file older than 24h (unattached to any project, deliverable, message, etc.)
      const orphanedFile = await prisma.file.create({
        data: {
          storageKey: `orphaned_${Date.now()}.png`,
          fileName: "orphaned.png",
          mimeType: "image/png",
          fileSize: BigInt(1024),
          uploadedById: testUser.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
        },
      });

      // B. Legitimate file with resourceType (e.g. PROFILE_AVATAR) older than 24h
      const avatarFile = await prisma.file.create({
        data: {
          storageKey: `avatar_${Date.now()}.png`,
          fileName: "avatar.png",
          mimeType: "image/png",
          fileSize: BigInt(2048),
          uploadedById: testUser.id,
          resourceType: "PROFILE_AVATAR",
          resourceId: testUser.id,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      });

      // Execute orphaned uploads cleanup job
      const outcome = await executeJob("CLEANUP_ORPHANED_UPLOADS");
      assert.equal(outcome.success, true);

      // Verify orphaned file was deleted
      const foundOrphan = await prisma.file.findUnique({
        where: { id: orphanedFile.id },
      });
      assert.equal(foundOrphan, null, "Unattached orphaned file should be deleted");

      // Verify avatar file was preserved
      const foundAvatar = await prisma.file.findUnique({
        where: { id: avatarFile.id },
      });
      assert.ok(foundAvatar, "File with resourceType must NEVER be deleted");
    } finally {
      await prisma.file.deleteMany({ where: { uploadedById: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Transactional Email Idempotency & Deduplication
  // ---------------------------------------------------------------------------
  await t.test("7. Email idempotency cache prevents duplicate sends within 5 minutes", () => {
    resetEmailIdempotencyCache();

    const key = "test_idempotency_hash_12345";

    // First call: not duplicate
    const isDup1 = isDuplicateEmail(key);
    assert.equal(isDup1, false, "Initial email dispatch must not be considered duplicate");

    // Immediate second call: duplicate
    const isDup2 = isDuplicateEmail(key);
    assert.equal(isDup2, true, "Subsequent send with same key must be recognized as duplicate and suppressed");

    // Different key: not duplicate
    const isDup3 = isDuplicateEmail("different_key_67890");
    assert.equal(isDup3, false, "Distinct email key must not be suppressed");
  });

  // ---------------------------------------------------------------------------
  // 8. Admin Permissions Domain Validation
  // ---------------------------------------------------------------------------
  await t.test("8. Admin permissions properly validate domains while preserving superadmin capability", () => {
    const superAdmin: AuthUser = {
      id: "admin_123",
      email: "admin@crewn.com",
      name: "Super Admin",
      avatarUrl: null,
      role: "ADMIN",
      isVerified: true,
      onboarded: true,
      businessMemberships: [],
      freelancerProfile: null,
    };

    const regularUser: AuthUser = {
      id: "user_456",
      email: "freelancer@crewn.com",
      name: "Freelancer",
      avatarUrl: null,
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      businessMemberships: [],
      freelancerProfile: null,
    };

    const permissions: AdminPermission[] = ["FINANCE", "MODERATION", "SUPPORT", "SYSTEM"];

    for (const perm of permissions) {
      assert.equal(hasAdminPermission(superAdmin, perm), true, `Superadmin must possess '${perm}' permission`);
      assert.equal(hasAdminPermission(regularUser, perm), false, `Non-admin must lack '${perm}' permission`);
    }
  });
});
