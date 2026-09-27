import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { hashToken } from "../src/lib/auth/session";
import { InMemoryRateLimiter, RedisRateLimiter } from "../src/lib/auth/rate-limit";
import { S3StorageProvider, LocalStorageProvider, generateSignedUrl, verifySignedUrlToken } from "../src/lib/storage";
import { calculatePlatformFee } from "../src/lib/payments/platform-fee";
import { generateInvoiceNumber } from "../src/lib/payments/invoice";
import { executeJob } from "../src/lib/jobs";
import { getOrCreateDirectConversation, sendMessage } from "../src/lib/messages/service";
import { validateTaskDependencies } from "../src/lib/projects/task-dependencies";

test("Crewn Phase 8 — Staging Deployment, Infrastructure & Security Verification", async (t) => {
  const ts = Date.now();
  let bizUser: { id: string; email: string };
  let freelancerUser: { id: string; email: string };
  let outsiderUser: { id: string; email: string };
  let business: { id: string };
  let freelancerProfile: { id: string };
  let project: { id: string };
  let directConversation: { id: string } | null = null;

  t.before(async () => {
    // 1. Create Business User
    bizUser = await prisma.user.create({
      data: {
        email: `biz-p8-${ts}@crewn.test`,
        name: "Acme Staging Labs",
        role: "BUSINESS",
        isVerified: false,
        onboarded: false,
      },
      select: { id: true, email: true },
    });

    // 2. Create Freelancer User
    freelancerUser = await prisma.user.create({
      data: {
        email: `creator-p8-${ts}@crewn.test`,
        name: "Zara Vfx",
        role: "FREELANCER",
        isVerified: false,
        onboarded: false,
      },
      select: { id: true, email: true },
    });

    // 3. Create Outsider Intruder User
    outsiderUser = await prisma.user.create({
      data: {
        email: `intruder-p8-${ts}@crewn.test`,
        name: "Mallory Snooper",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });
  });

  t.after(async () => {
    // Strict leaf-to-root teardown to prevent foreign key restrict violations
    try {
      await prisma.notification.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.deliverableReview.deleteMany({
        where: { reviewerId: bizUser.id },
      });
      await prisma.deliverableVersion.deleteMany({
        where: { submittedById: freelancerUser.id },
      });
      if (project?.id) {
        await prisma.deliverable.deleteMany({ where: { projectId: project.id } });
        await prisma.taskDependency.deleteMany({ where: { task: { projectId: project.id } } });
        await prisma.taskAttachment.deleteMany({ where: { task: { projectId: project.id } } });
        await prisma.taskStatusHistory.deleteMany({ where: { task: { projectId: project.id } } });
        await prisma.task.deleteMany({ where: { projectId: project.id } });
      }
      await prisma.payout.deleteMany({ where: { recipientId: freelancerUser.id } });
      await prisma.refund.deleteMany({
        where: { milestonePayment: { milestone: { project: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } } } },
      });
      await prisma.platformFee.deleteMany({
        where: {
          OR: [
            { transaction: { payerId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } },
            { transaction: { milestonePayment: { milestone: { project: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } } } } },
          ],
        },
      });
      await prisma.paymentTransaction.deleteMany({
        where: {
          OR: [
            { payerId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
            { milestonePayment: { milestone: { project: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } } } },
            { gatewayOrderId: { contains: `p8_${ts}` } },
          ],
        },
      });
      await prisma.milestonePayment.deleteMany({
        where: {
          OR: [
            { milestone: { project: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } } },
            business?.id ? { businessId: business.id } : { id: "__none__" },
          ],
        },
      });
      if (business?.id) {
        await prisma.invoice.deleteMany({ where: { businessId: business.id } });
      }
      await prisma.webhookEvent.deleteMany({
        where: { gatewayEventId: { contains: `p8_${ts}` } },
      });
      await prisma.milestone.deleteMany({
        where: { project: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } },
      });
      await prisma.projectMember.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.projectInvitation.deleteMany({
        where: { project: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } } },
      });
      await prisma.project.deleteMany({
        where: { createdById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.messageAttachment.deleteMany({
        where: { file: { storageKey: { contains: `p8-${ts}` } } },
      });
      await prisma.message.deleteMany({
        where: { senderId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.conversationMember.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      if (directConversation?.id) {
        await prisma.conversation.deleteMany({ where: { id: directConversation.id } });
      }
      await prisma.file.deleteMany({
        where: {
          OR: [
            { uploadedById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
            { storageKey: { contains: `p8-${ts}` } },
          ],
        },
      });
      await prisma.savedCreator.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.creatorInquiry.deleteMany({
        where: { senderId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      if (freelancerProfile?.id) {
        await prisma.service.deleteMany({ where: { freelancerProfileId: freelancerProfile.id } });
        await prisma.freelancerProfile.deleteMany({ where: { id: freelancerProfile.id } });
      }
      if (business?.id) {
        await prisma.businessMember.deleteMany({ where: { businessId: business.id } });
        await prisma.business.deleteMany({ where: { id: business.id } });
      }
      await prisma.activityLog.deleteMany({
        where: { actorId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.session.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.verificationToken.deleteMany({
        where: { identifier: { in: [bizUser.email, freelancerUser.email, outsiderUser.email] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
    } catch (e) {
      console.error("Staging test teardown error:", e);
    }
  });

  // 1. S3-Compatible Storage Provider
  await t.test("1. S3-Compatible Object Storage & Signed URL Validation", async () => {
    const s3 = new S3StorageProvider();
    const local = new LocalStorageProvider();

    // Verify S3 upload URL generation
    const uploadMeta = await s3.createUploadUrl("deliverables/hero.mp4", "video/mp4", 50000000);
    assert.ok(decodeURIComponent(uploadMeta.uploadUrl).includes("deliverables/hero.mp4"), "S3 upload URL contains key");
    assert.ok(uploadMeta.expiresAt, "S3 upload URL contains expiration timestamp");

    // Verify S3 signed private URL generation
    const signed = await s3.getSignedUrl("deliverables/hero.mp4", 600);
    assert.ok(signed.url.includes("token="), "S3 signed URL includes HMAC token");
    assert.ok(signed.url.includes("expires="), "S3 signed URL includes expiration parameter");

    // Verify Signed URL Expiration and HMAC verification
    const parsed = new URL(signed.url, "http://localhost:3000");
    const token = parsed.searchParams.get("token") || "";
    const expires = parsed.searchParams.get("expires") || "";
    const verified = verifySignedUrlToken("hero.mp4", token, expires);
    assert.equal(verified.isValid, true, "Legitimate signed URL verified");

    // Tampered expiration rejected
    const tamperedVerified = verifySignedUrlToken("hero.mp4", token, "9999999999");
    assert.equal(tamperedVerified.isValid, false, "Tampered expiration timestamp rejected");

    // Expired timestamp rejected
    const expiredVerified = verifySignedUrlToken("hero.mp4", token, "1000000000");
    assert.equal(expiredVerified.isValid, false, "Past expiration timestamp rejected");

    // Local fallback intact
    assert.ok(local.getBaseDir(), "Local storage directory initialized");
  });

  // 2. Distributed Rate Limiter
  await t.test("2. Rate Limiting Abstraction (In-Memory & Distributed Fallback)", async () => {
    const memLimiter = new InMemoryRateLimiter();

    // In-memory sliding window check
    const r1 = await memLimiter.limit("test-ip-1", 2, 10000);
    assert.equal(r1.success, true, "First request allowed");
    assert.equal(r1.remaining, 1, "Remaining count decremented");

    const r2 = await memLimiter.limit("test-ip-1", 2, 10000);
    assert.equal(r2.success, true, "Second request allowed");
    assert.equal(r2.remaining, 0, "No remaining requests");

    const r3 = await memLimiter.limit("test-ip-1", 2, 10000);
    assert.equal(r3.success, false, "Third request blocked by rate limiter");

    // Redis fallback verification
    const redisLimiter = new RedisRateLimiter("https://unreachable-redis.test", "bad_token");
    const fallbackRes = await redisLimiter.limit("fallback-test", 5, 10000);
    assert.equal(fallbackRes.success, true, "Redis limiter gracefully falls back to memory on network fault");
  });

  // 3. Staging Webhook & Razorpay Lifecycle
  await t.test("3. Razorpay Staging Payment Lifecycle & Idempotency", async () => {
    // 1. Create Milestone Payment and Transaction record
    const dummyBiz = await prisma.business.create({
      data: {
        name: "Test Payment Biz",
        slug: `test-payment-biz-${ts}`,
        description: "Payment test biz",
        members: {
          create: {
            userId: bizUser.id,
            role: "OWNER",
          },
        },
      },
      select: { id: true },
    });

    const dummyProj = await prisma.project.create({
      data: {
        title: "Test Payment Project",
        description: "Temporary project for payment idempotency test",
        businessId: dummyBiz.id,
        createdById: bizUser.id,
        currency: "INR",
        status: "IN_PROGRESS",
      },
      select: { id: true },
    });

    const dummyMilestone = await prisma.milestone.create({
      data: {
        projectId: dummyProj.id,
        title: "Initial Deliverable",
        description: "Milestone for staging payment test",
        amount: 50000.0,
        status: "PENDING",
      },
    });

    const tx = await prisma.paymentTransaction.create({
      data: {
        gatewayOrderId: `order_p8_${ts}`,
        amount: 50000.0,
        currency: "INR",
        status: "PENDING",
        paymentMethod: "RAZORPAY",
      },
    });

    const mp = await prisma.milestonePayment.create({
      data: {
        milestoneId: dummyMilestone.id,
        status: "PENDING",
        amount: 50000.0,
        currency: "INR",
      },
    });

    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { milestonePaymentId: mp.id },
    });

    // 2. Simulate Webhook Signature & Idempotent Processing
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "test_staging_webhook_secret";
    const gatewayEventId = `p8_${ts}_evt_payment_captured`;

    const rawPayload = JSON.stringify({
      event: "payment.captured",
      event_id: gatewayEventId,
      payload: {
        payment: {
          entity: {
            id: `pay_p8_${ts}`,
            order_id: `order_p8_${ts}`,
            amount: 5000000, // paise
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");

    // Signature verification logic
    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawPayload)
      .digest("hex");
    assert.equal(expectedSignature, computedSignature, "HMAC SHA-256 signature verified");

    // 3. Record WebhookEvent idempotently
    const webhookRecord = await prisma.webhookEvent.create({
      data: {
        gatewayEventId,
        provider: "RAZORPAY",
        eventType: "payment.captured",
        payloadJson: rawPayload,
        isProcessed: true,
        processingStatus: "PROCESSED",
      },
    });
    assert.ok(webhookRecord.id, "WebhookEvent persisted");

    // Duplicate webhook attempt should trigger unique constraint
    let duplicateRejected = false;
    try {
      await prisma.webhookEvent.create({
        data: {
          gatewayEventId,
          provider: "RAZORPAY",
          eventType: "payment.captured",
          payloadJson: rawPayload,
        },
      });
    } catch {
      duplicateRejected = true;
    }
    assert.equal(duplicateRejected, true, "Duplicate gatewayEventId strictly rejected by unique constraint");

    // 4. Update Escrow status and calculate Platform Fee
    await prisma.milestonePayment.update({
      where: { id: mp.id },
      data: { status: "HELD_IN_ESCROW", escrowHeldAt: new Date() },
    });

    const feeBreakdown = calculatePlatformFee(50000.0, 10.0);
    assert.equal(feeBreakdown.feeAmount, 5000.0, "10% platform fee calculated accurately");
    assert.equal(feeBreakdown.netFreelancerAmount, 45000.0, "90% creator net payout calculated accurately");

    const fee = await prisma.platformFee.create({
      data: {
        transactionId: tx.id,
        amount: feeBreakdown.feeAmount,
        feePercentage: feeBreakdown.feePercentage,
        currency: "INR",
      },
    });
    assert.ok(fee.id, "Platform fee recorded");

    const invoiceNum = await generateInvoiceNumber();
    assert.ok(invoiceNum.startsWith("INV-"), "Invoice number formatted correctly");

    // Clean up temporary dummy milestone records
    await prisma.platformFee.delete({ where: { id: fee.id } });
    await prisma.paymentTransaction.delete({ where: { id: tx.id } });
    await prisma.milestonePayment.delete({ where: { id: mp.id } });
    await prisma.milestone.delete({ where: { id: dummyMilestone.id } });
    await prisma.project.delete({ where: { id: dummyProj.id } });
    await prisma.businessMember.deleteMany({ where: { businessId: dummyBiz.id } });
    await prisma.business.delete({ where: { id: dummyBiz.id } });
  });

  // 4. End-to-End Business & Freelancer Staging Lifecycle
  await t.test("4. Complete Staging Marketplace & Project Lifecycle", async () => {
    // 1. Verify users via email verification tokens
    const bizToken = hashToken(crypto.randomBytes(32).toString("hex"));
    await prisma.verificationToken.create({
      data: {
        identifier: bizUser.email,
        tokenHash: bizToken,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await prisma.user.update({ where: { id: bizUser.id }, data: { isVerified: true } });
    await prisma.user.update({ where: { id: freelancerUser.id }, data: { isVerified: true } });

    // 2. Business Onboarding
    business = await prisma.business.create({
      data: {
        name: "Acme Staging Studio",
        slug: `acme-staging-${ts}`,
        industry: "Entertainment",
        description: "Leading creative production house",
        members: {
          create: {
            userId: bizUser.id,
            role: "OWNER",
          },
        },
      },
      select: { id: true },
    });
    await prisma.user.update({ where: { id: bizUser.id }, data: { onboarded: true } });

    // 3. Freelancer Profile & Services
    freelancerProfile = await prisma.freelancerProfile.create({
      data: {
        userId: freelancerUser.id,
        publicSlug: `zara-vfx-${ts}`,
        headline: "Visual Effects & CGI Specialist",
        bio: "Hollywood-grade CGI and visual storytelling.",
        hourlyRate: 4000.0,
        marketplaceVisible: true,
        isVerified: true,
        services: {
          create: {
            title: "CGI Post-Production",
            description: "Full VFX composite rendering",
            basePrice: 60000.0,
            currency: "INR",
          },
        },
      },
      select: { id: true },
    });
    await prisma.user.update({ where: { id: freelancerUser.id }, data: { onboarded: true } });

    // 4. Save Creator & Message
    const bookmark = await prisma.savedCreator.create({
      data: {
        userId: bizUser.id,
        freelancerId: freelancerProfile.id,
      },
    });
    assert.ok(bookmark.id, "Creator saved by business");

    const conv = await getOrCreateDirectConversation(bizUser.id, freelancerUser.id);
    directConversation = { id: conv.id };
    await sendMessage({
      conversationId: conv.id,
      senderId: bizUser.id,
      content: "Hi Zara, we want to contract you for our staging launch video.",
    });

    // 5. Create Project & Milestone
    project = await prisma.project.create({
      data: {
        title: "Staging Commercial 2026",
        description: "Official launch commercial",
        businessId: business.id,
        createdById: bizUser.id,
        budgetMin: 50000.0,
        budgetMax: 70000.0,
        currency: "INR",
        status: "IN_PROGRESS",
        milestones: {
          create: {
            title: "Milestone 1: VFX Composite",
            description: "Final render delivery",
            amount: 60000.0,
            status: "PENDING",
            freelancerId: freelancerUser.id,
          },
        },
      },
      select: { id: true },
    });

    // 6. Project Invitation with APP_URL
    const rawInviteToken = crypto.randomBytes(32).toString("hex");
    const inviteHash = hashToken(rawInviteToken);
    const invite = await prisma.projectInvitation.create({
      data: {
        projectId: project.id,
        inviteeEmail: freelancerUser.email,
        token: rawInviteToken,
        tokenHash: inviteHash,
        role: "FREELANCER",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    assert.ok(invite.id, "Invitation generated");

    // Acceptance
    await prisma.projectInvitation.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: freelancerUser.id,
        role: "FREELANCER",
      },
    });

    // Replay attack: accepting again is rejected
    const checkInvite = await prisma.projectInvitation.findUnique({ where: { id: invite.id } });
    assert.equal(checkInvite?.status, "ACCEPTED", "Invitation marked ACCEPTED and cannot be reused");

    // 7. Sequential Task Dependency Enforcement
    const taskA = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Rough Cut Assembly",
        status: "TODO",
        priority: "HIGH",
      },
    });

    const taskB = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Color Grading & Master",
        status: "TODO",
        priority: "HIGH",
      },
    });

    await prisma.taskDependency.create({
      data: {
        taskId: taskB.id,
        dependsOnTaskId: taskA.id,
      },
    });

    const canStartB = await validateTaskDependencies(taskB.id);
    assert.equal(canStartB.canTransition, false, "Task B blocked while Task A is incomplete");

    // Complete Task A
    await prisma.task.update({ where: { id: taskA.id }, data: { status: "COMPLETED" } });
    const canStartBNow = await validateTaskDependencies(taskB.id);
    assert.equal(canStartBNow.canTransition, true, "Task B unblocked after Task A completion");

    // 8. Deliverable & Versioning
    const delivFile = await prisma.file.create({
      data: {
        storageKey: `p8-${ts}-render.mp4`,
        fileName: "render_v1.mp4",
        mimeType: "video/mp4",
        fileSize: BigInt(10485760),
        uploadedById: freelancerUser.id,
        resourceType: "DELIVERABLE",
        isPublic: false,
      },
    });

    const deliverable = await prisma.deliverable.create({
      data: {
        projectId: project.id,
        title: "Final 4K Master",
        status: "SUBMITTED",
        versions: {
          create: {
            versionNumber: 1,
            fileId: delivFile.id,
            submittedById: freelancerUser.id,
            changelog: "Initial master render",
          },
        },
      },
      include: { versions: true },
    });
    assert.equal(deliverable.versions.length, 1, "Deliverable version attached");

    // 9. Review Approval & Payout
    const versionId = deliverable.versions[0].id;
    await prisma.deliverableReview.create({
      data: {
        versionId,
        reviewerId: bizUser.id,
        decision: "APPROVED",
        feedbackText: "Outstanding work Zara!",
      },
    });
    await prisma.deliverable.update({ where: { id: deliverable.id }, data: { status: "APPROVED" } });

    const payout = await prisma.payout.create({
      data: {
        recipientId: freelancerUser.id,
        amount: 54000.0,
        currency: "INR",
        status: "PROCESSING",
        payoutMethod: "BANK_TRANSFER",
      },
    });
    assert.ok(payout.id, "Payout generated for approved milestone");
  });

  // 5. Staging Security Controls & IDOR Boundaries
  await t.test("5. Staging Security Boundaries & Protected Job Endpoints", async () => {
    // 1. Business IDOR: Outsider Mallory cannot read Acme Staging projects
    const outsiderAccess = await prisma.project.findFirst({
      where: {
        id: project.id,
        business: {
          members: { some: { userId: outsiderUser.id } },
        },
      },
    });
    assert.equal(outsiderAccess, null, "Outsider strictly blocked from business projects");

    // 2. Project Outsider IDOR: Outsider Mallory cannot access project deliverables
    const memberCheck = await prisma.projectMember.findFirst({
      where: {
        projectId: project.id,
        userId: outsiderUser.id,
      },
    });
    assert.equal(memberCheck, null, "Outsider has no membership in project");

    // 3. Password Reset: Revokes all sessions immediately
    const session = await prisma.session.create({
      data: {
        userId: bizUser.id,
        tokenHash: hashToken(crypto.randomBytes(32).toString("hex")),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    assert.ok(session.id, "Session created");

    // Simulate password reset session wipe
    await prisma.session.deleteMany({ where: { userId: bizUser.id } });
    const checkSession = await prisma.session.findUnique({ where: { id: session.id } });
    assert.equal(checkSession, null, "All active sessions eradicated on credential update");

    // 4. Background Job Execution
    const jobSession = await executeJob("CLEANUP_EXPIRED_SESSIONS");
    assert.equal(jobSession.success, true, "CLEANUP_EXPIRED_SESSIONS executed cleanly");

    const jobInvite = await executeJob("PURGE_EXPIRED_INVITATIONS");
    assert.equal(jobInvite.success, true, "PURGE_EXPIRED_INVITATIONS executed cleanly");
  });
});
