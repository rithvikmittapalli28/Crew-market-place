import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { hashToken } from "../src/lib/auth/session";

// Admin service & auth
import {
  getAdminDashboardMetrics,
  getAdminUsers,
  suspendUser,
  reactivateUser,
  getAdminSystemHealth,
} from "../src/lib/admin/service";

// Disputes service
import {
  createDispute,
  getDispute,
  listDisputes,
  addDisputeMessage,
  resolveDispute,
} from "../src/lib/disputes/service";

// Moderation service
import {
  submitReport,
  listReports,
  getReportDetail,
  reviewReport,
} from "../src/lib/moderation/service";

// API route handlers
import { GET as getAdminDashboardRoute } from "../src/app/api/admin/dashboard/route";
import { GET as getAdminUsersRoute } from "../src/app/api/admin/users/route";
import { POST as suspendUserRoute } from "../src/app/api/admin/users/[userId]/suspend/route";
import { POST as reactivateUserRoute } from "../src/app/api/admin/users/[userId]/reactivate/route";
import { GET as getAdminDisputesRoute } from "../src/app/api/admin/disputes/route";
import { GET as getAdminDisputeDetailRoute } from "../src/app/api/admin/disputes/[disputeId]/route";
import { POST as resolveDisputeRoute } from "../src/app/api/admin/disputes/[disputeId]/resolve/route";
import { GET as getAdminModerationRoute } from "../src/app/api/admin/moderation/route";
import { PATCH as reviewModerationReportRoute } from "../src/app/api/admin/moderation/[reportId]/route";
import { GET as getAdminAuditLogsRoute } from "../src/app/api/admin/audit-logs/route";
import { GET as getAdminSystemHealthRoute } from "../src/app/api/admin/system-health/route";
import { GET as getDisputeRoute, POST as postDisputeMessageRoute } from "../src/app/api/disputes/[disputeId]/route";

// ─── Test Suite ───────────────────────────────────────────────────────────────

test("Phase 11: Admin, Disputes, Moderation & Platform Operations Suite", async (t) => {
  const timestamp = Date.now();

  let adminUser: { id: string; email: string };
  let businessUser: { id: string; email: string };
  let freelancerUser: { id: string; email: string };
  let outsiderUser: { id: string; email: string };

  let tokenAdmin: string;
  let tokenBusiness: string;
  let tokenFreelancer: string;
  let tokenOutsider: string;

  let business: { id: string };
  let project: { id: string };
  let contract: { id: string };
  let milestone: { id: string };

  t.before(async () => {
    // 1. Create Users
    adminUser = await prisma.user.create({
      data: {
        email: `admin-ph11-${timestamp}@crewn.test`,
        name: "Platform Administrator",
        role: "ADMIN",
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    businessUser = await prisma.user.create({
      data: {
        email: `biz-ph11-${timestamp}@crewn.test`,
        name: "Business Client Phase11",
        role: "BUSINESS",
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    freelancerUser = await prisma.user.create({
      data: {
        email: `free-ph11-${timestamp}@crewn.test`,
        name: "Lead Creator Phase11",
        role: "FREELANCER",
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    outsiderUser = await prisma.user.create({
      data: {
        email: `outsider-ph11-${timestamp}@crewn.test`,
        name: "Unrelated Outsider",
        role: "FREELANCER",
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    // 2. Create Sessions
    tokenAdmin = crypto.randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: hashToken(tokenAdmin),
        userId: adminUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });

    tokenBusiness = crypto.randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: hashToken(tokenBusiness),
        userId: businessUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });

    tokenFreelancer = crypto.randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: hashToken(tokenFreelancer),
        userId: freelancerUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });

    tokenOutsider = crypto.randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: hashToken(tokenOutsider),
        userId: outsiderUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });

    // 3. Create Business profile
    business = await prisma.business.create({
      data: {
        name: `Acme Phase11 Corp ${timestamp}`,
        slug: `acme-ph11-${timestamp}`,
        industry: "Design & Technology",
        taxId: "27AAACB2212P1Z0",
        members: {
          create: [{ userId: businessUser.id, role: "OWNER" }],
        },
      },
      select: { id: true },
    });

    // 4. Create Project
    project = await prisma.project.create({
      data: {
        businessId: business.id,
        createdById: businessUser.id,
        title: `E-Commerce Redesign Phase11 ${timestamp}`,
        description: "Complete design overhaul and frontend engineering",
        budgetMin: 50000,
        budgetMax: 75000,
        currency: "INR",
        status: "IN_PROGRESS",
        members: {
          create: [
            { userId: businessUser.id, role: "OWNER" },
            { userId: freelancerUser.id, role: "FREELANCER" },
          ],
        },
      },
      select: { id: true },
    });

    // 5. Create Milestone with Escrow
    milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: "Sprint 1 Deliverables",
        description: "Wireframes and high-fidelity mockups",
        amount: 30000,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    // Milestone payment record
    await prisma.milestonePayment.create({
      data: {
        milestoneId: milestone.id,
        amount: 30000,
        currency: "INR",
        status: "HELD_IN_ESCROW",
        escrowHeldAt: new Date(),
      },
    });

    // 6. Create Contract
    contract = await prisma.contract.create({
      data: {
        projectId: project.id,
        businessId: business.id,
        title: "Master Services Agreement Phase11",
        termsText: "Master terms and condition statements.",
        status: "EXECUTED",
        totalAmount: 75000,
        executedAt: new Date(),
        parties: {
          create: [
            { userId: businessUser.id, role: "CLIENT_SIGNER", signedAt: new Date() },
            { userId: freelancerUser.id, role: "FREELANCER_SIGNER", signedAt: new Date() },
          ],
        },
      },
      select: { id: true },
    });
  });

  t.after(async () => {
    // Cleanup test artifacts
    await prisma.activityLog.deleteMany({
      where: {
        actorId: { in: [adminUser.id, businessUser.id, freelancerUser.id, outsiderUser.id] },
      },
    });
    await prisma.moderationReport.deleteMany({
      where: {
        reporterId: { in: [adminUser.id, businessUser.id, freelancerUser.id, outsiderUser.id] },
      },
    });
    await prisma.disputeMessage.deleteMany({
      where: {
        senderId: { in: [adminUser.id, businessUser.id, freelancerUser.id, outsiderUser.id] },
      },
    });
    await prisma.dispute.deleteMany({
      where: {
        initiatorId: { in: [adminUser.id, businessUser.id, freelancerUser.id, outsiderUser.id] },
      },
    });
    await prisma.contractParty.deleteMany({ where: { contract: { projectId: project?.id } } }).catch(() => {});
    await prisma.contract.deleteMany({ where: { projectId: project?.id } }).catch(() => {});
    await prisma.payout.deleteMany({ where: { milestonePayment: { milestone: { projectId: project?.id } } } }).catch(() => {});
    await prisma.refund.deleteMany({ where: { milestonePayment: { milestone: { projectId: project?.id } } } }).catch(() => {});
    await prisma.milestonePayment.deleteMany({ where: { milestone: { projectId: project?.id } } }).catch(() => {});
    await prisma.milestone.deleteMany({ where: { projectId: project?.id } }).catch(() => {});
    await prisma.projectMember.deleteMany({ where: { projectId: project?.id } }).catch(() => {});
    await prisma.project.deleteMany({ where: { id: project?.id } }).catch(() => {});
    await prisma.businessMember.deleteMany({ where: { businessId: business?.id } }).catch(() => {});
    await prisma.business.deleteMany({ where: { id: business?.id } }).catch(() => {});
    await prisma.session.deleteMany({
      where: { userId: { in: [adminUser.id, businessUser.id, freelancerUser.id, outsiderUser.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, businessUser.id, freelancerUser.id, outsiderUser.id] } },
    }).catch(() => {});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Admin Role & Authorization Boundary Guards
  // ─────────────────────────────────────────────────────────────────────────────

  await t.test("1.1 Non-admin users are strictly blocked from admin dashboard API with 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/dashboard", {
      headers: { cookie: `crewn_session=${tokenBusiness}` },
    });
    const res = await getAdminDashboardRoute(req);
    assert.equal(res.status, 403, "Business user should receive 403 Forbidden on admin endpoint");
  });

  await t.test("1.2 Freelancer user is strictly blocked from admin user management with 403", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/users", {
      headers: { cookie: `crewn_session=${tokenFreelancer}` },
    });
    const res = await getAdminUsersRoute(req);
    assert.equal(res.status, 403, "Freelancer user should receive 403 Forbidden");
  });

  await t.test("1.3 Unauthenticated request to admin route returns 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/system-health");
    const res = await getAdminSystemHealthRoute(req);
    assert.equal(res.status, 401, "Unauthenticated request should receive 401");
  });

  await t.test("1.4 Admin user successfully fetches admin dashboard operational metrics (200 OK)", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/dashboard", {
      headers: { cookie: `crewn_session=${tokenAdmin}` },
    });
    const res = await getAdminDashboardRoute(req);
    assert.equal(res.status, 200, "Admin should receive 200 OK");
    const data = await res.json();
    assert.ok(data.counts, "Counts payload must be present");
    assert.ok(typeof data.counts.totalUsers === "number", "totalUsers count must be a number");
    assert.ok(typeof data.financial?.grossTransactionVolumeINR === "number", "Gross volume must be returned");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. User Management, Suspension & Immediate Session Revocation
  // ─────────────────────────────────────────────────────────────────────────────

  await t.test("2.1 Admin lists users with search query and pagination", async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/users?search=Phase11`, {
      headers: { cookie: `crewn_session=${tokenAdmin}` },
    });
    const res = await getAdminUsersRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.users), "Users must be an array");
    assert.ok(data.users.length >= 2, "Must return at least business & freelancer Phase11 users");
  });

  await t.test("2.2 Admin suspends a user: account is deactivated and all active sessions are revoked", async () => {
    // Check initial active sessions for business user
    const sessionsBefore = await prisma.session.findMany({ where: { userId: businessUser.id, revokedAt: null } });
    assert.ok(sessionsBefore.length > 0, "Business user must have active session before suspension");

    const req = new NextRequest(`http://localhost:3000/api/admin/users/${businessUser.id}/suspend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `crewn_session=${tokenAdmin}`,
      },
      body: JSON.stringify({ reason: "Violation of marketplace code of conduct" }),
    });

    const res = await suspendUserRoute(req, { params: Promise.resolve({ userId: businessUser.id }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.isActive, false, "User isActive must be false");

    // Verify in database: isActive = false and active sessions count = 0
    const dbUser = await prisma.user.findUnique({ where: { id: businessUser.id } });
    assert.equal(dbUser?.isActive, false, "Database isActive must be updated");

    const sessionsAfter = await prisma.session.findMany({ where: { userId: businessUser.id, revokedAt: null } });
    assert.equal(sessionsAfter.length, 0, "All active sessions must be revoked upon suspension");

    // Verify audit log entry
    const auditLog = await prisma.activityLog.findFirst({
      where: {
        action: "ADMIN_SUSPEND_USER",
        entityId: businessUser.id,
      },
    });
    assert.ok(auditLog, "Suspension must write an audit log entry");
  });

  await t.test("2.3 Admin reactivates a suspended user", async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/users/${businessUser.id}/reactivate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `crewn_session=${tokenAdmin}`,
      },
      body: JSON.stringify({ reason: "Appeal reviewed and verified" }),
    });

    const res = await reactivateUserRoute(req, { params: Promise.resolve({ userId: businessUser.id }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.isActive, true, "User isActive must be restored to true");

    // Clean up old revoked sessions and recreate fresh session for business user
    await prisma.session.deleteMany({ where: { userId: businessUser.id } });
    await prisma.session.create({
      data: {
        tokenHash: hashToken(tokenBusiness),
        userId: businessUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Dispute Lifecycle, Evidence Messaging & Financial Resolutions
  // ─────────────────────────────────────────────────────────────────────────────

  let createdDisputeId: string;

  await t.test("3.1 Project participant creates a formal dispute with initial reason", async () => {
    const dispute = await createDispute({
      initiatorId: businessUser.id,
      projectId: project.id,
      contractId: contract.id,
      milestoneId: milestone.id,
      reason: "Deliverable does not match signed scope of work specifications.",
      category: "DELIVERABLE_QUALITY",
    });

    assert.ok(dispute.id, "Dispute must have a generated ID");
    assert.equal(dispute.status, "OPEN", "Initial dispute status must be OPEN");
    createdDisputeId = dispute.id;
  });

  await t.test("3.2 Unauthorized outsider is blocked from viewing dispute (403 Forbidden)", async () => {
    const req = new NextRequest(`http://localhost:3000/api/disputes/${createdDisputeId}`, {
      headers: { cookie: `crewn_session=${tokenOutsider}` },
    });
    const res = await getDisputeRoute(req, { params: Promise.resolve({ disputeId: createdDisputeId }) });
    assert.equal(res.status, 403, "Outsider must receive 403 Forbidden");
  });

  await t.test("3.3 Freelancer posts evidence message to active dispute", async () => {
    const req = new NextRequest(`http://localhost:3000/api/disputes/${createdDisputeId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `crewn_session=${tokenFreelancer}`,
      },
      body: JSON.stringify({
        message: "Attached Figma link and design tokens conforming 100% to section 3.2.",
      }),
    });

    const res = await postDisputeMessageRoute(req, { params: Promise.resolve({ disputeId: createdDisputeId }) });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.message.id, "Dispute message must be created");
    assert.equal(data.message.senderId, freelancerUser.id);
  });

  await t.test("3.4 Admin views dispute detail with audit history and messages", async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/disputes/${createdDisputeId}`, {
      headers: { cookie: `crewn_session=${tokenAdmin}` },
    });
    const res = await getAdminDisputeDetailRoute(req, { params: Promise.resolve({ disputeId: createdDisputeId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.dispute.id, createdDisputeId);
    assert.ok(data.dispute.messages.length >= 1, "Messages must be loaded");
  });

  await t.test("3.5 Admin executes financial resolution: RELEASE_ESCROW to freelancer", async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/disputes/${createdDisputeId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `crewn_session=${tokenAdmin}`,
      },
      body: JSON.stringify({
        action: "RELEASE_ESCROW",
        adminNotes: "Evidence shows deliverables meet acceptance criteria. Escrow released to creator.",
        releaseAmount: 30000,
      }),
    });

    const res = await resolveDisputeRoute(req, { params: Promise.resolve({ disputeId: createdDisputeId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.dispute.status, "RESOLVED_CREATOR");
    assert.equal(data.dispute.resolutionAction, "RELEASE_ESCROW");

    // Verify milestone payment status updated to RELEASED
    const milestonePayment = await prisma.milestonePayment.findFirst({
      where: { milestoneId: milestone.id },
    });
    assert.equal(milestonePayment?.status, "RELEASED", "Escrow payment must transition to RELEASED");

    // Verify milestone status updated to PAID
    const dbMilestone = await prisma.milestone.findUnique({ where: { id: milestone.id } });
    assert.equal(dbMilestone?.status, "PAID", "Milestone status must become PAID");
  });

  await t.test("3.6 Admin resolves dispute with REFUND_BUYER in a second milestone test", async () => {
    // Create second milestone with escrow
    const ms2 = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title: "Sprint 2 Deliverables",
        amount: 20000,
        status: "ACTIVE",
      },
    });
    await prisma.milestonePayment.create({
      data: {
        milestoneId: ms2.id,
        amount: 20000,
        currency: "INR",
        status: "HELD_IN_ESCROW",
      },
    });

    const disp2 = await createDispute({
      initiatorId: businessUser.id,
      projectId: project.id,
      milestoneId: ms2.id,
      category: "NON_DELIVERY",
      reason: "No deliverable submitted by deadline.",
    });

    const result = await resolveDispute({
      disputeId: disp2.id,
      adminUserId: adminUser.id,
      resolutionAction: "REFUND_BUYER",
      resolutionText: "Full refund issued due to non-delivery.",
      adminNotes: "Full refund issued due to non-delivery.",
      refundAmount: 20000,
    });

    assert.equal(result.status, "RESOLVED_BUYER");
    const ms2Payment = await prisma.milestonePayment.findFirst({ where: { milestoneId: ms2.id } });
    assert.equal(ms2Payment?.status, "REFUNDED", "Payment status must transition to REFUNDED");

    // Clean up ms2 and related refund records
    if (ms2Payment) {
      await prisma.refund.deleteMany({ where: { milestonePaymentId: ms2Payment.id } }).catch(() => {});
    }
    await prisma.milestonePayment.deleteMany({ where: { milestoneId: ms2.id } }).catch(() => {});
    await prisma.milestone.deleteMany({ where: { id: ms2.id } }).catch(() => {});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Moderation Reporting, Reviews & Administrative Actions
  // ─────────────────────────────────────────────────────────────────────────────

  let createdReportId: string;

  await t.test("4.1 User files moderation report for content/user policy violation", async () => {
    const report = await submitReport({
      reporterId: businessUser.id,
      targetType: "USER",
      targetId: outsiderUser.id,
      reason: "Sent unsolicited spam promotional links in chat.",
    });

    assert.ok(report.id, "Report must have an ID");
    assert.equal(report.status, "PENDING", "Initial report status must be PENDING");
    createdReportId = report.id;
  });

  await t.test("4.2 Admin lists moderation reports with filter", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/moderation?status=PENDING", {
      headers: { cookie: `crewn_session=${tokenAdmin}` },
    });
    const res = await getAdminModerationRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.reports));
    assert.ok(data.reports.some((r: any) => r.id === createdReportId));
  });

  await t.test("4.3 Admin reviews report and takes action (WARNING)", async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/moderation/${createdReportId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `crewn_session=${tokenAdmin}`,
      },
      body: JSON.stringify({
        status: "ACTION_TAKEN_WARNING",
        actionTaken: "WARNING",
        adminNotes: "First offense formal warning issued for spamming.",
      }),
    });

    const res = await reviewModerationReportRoute(req, { params: Promise.resolve({ reportId: createdReportId }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.report.status, "ACTION_TAKEN_WARNING");
    assert.equal(data.report.reviewedById, adminUser.id);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. System Health, Audit Trail & Realtime Oversight
  // ─────────────────────────────────────────────────────────────────────────────

  await t.test("5.1 Admin fetches system health diagnostics", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/system-health", {
      headers: { cookie: `crewn_session=${tokenAdmin}` },
    });
    const res = await getAdminSystemHealthRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.status, "System health status must be present");
    assert.ok(data.services?.database, "Database service status must be present");
    assert.ok(typeof data.services.database.latencyMs === "number", "Database latency in ms must be returned");
  });

  await t.test("5.2 Admin queries immutable audit logs ledger", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/audit-logs", {
      headers: { cookie: `crewn_session=${tokenAdmin}` },
    });
    const res = await getAdminAuditLogsRoute(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.logs), "Audit logs must be returned as array");
    assert.ok(data.logs.some((l: any) => l.action.startsWith("ADMIN_")), "Must contain ADMIN action logs");
  });
});
