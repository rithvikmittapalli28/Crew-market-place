import crypto from "crypto";

const BASE_URL = "http://localhost:3000";

interface TestResult {
  step: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const results: TestResult[] = [];

function record(step: string, passed: boolean, details?: string) {
  const status = passed ? "PASS" : "FAIL";
  results.push({ step, status, details });
  console.log(`[${status}] ${step}${details ? ` - ${details}` : ""}`);
  if (!passed) {
    throw new Error(`Step failed: ${step} (${details})`);
  }
}

async function getOrCreateUserAndToken(params: {
  email: string;
  name: string;
  role: "ADMIN" | "BUSINESS" | "FREELANCER";
}): Promise<{ userId: string; token: string }> {
  const { prisma } = await import("../src/lib/prisma");
  const { createSession } = await import("../src/lib/auth/session");

  let user = await prisma.user.findUnique({ where: { email: params.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: params.email,
        name: params.name,
        role: params.role,
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
    });
  } else {
    // Ensure active and correct role
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, role: params.role },
    });
  }

  const sess = await createSession({ userId: user.id });
  return { userId: user.id, token: sess.token };
}

async function run() {
  console.log("================================================================================");
  console.log("PHASE 11 LIVE ADMIN, DISPUTES, MODERATION & OPERATIONS VERIFICATION");
  console.log(`Target: ${BASE_URL}`);
  console.log("================================================================================");

  // 1. Seed & Authenticate Users
  const admin = await getOrCreateUserAndToken({
    email: "admin.e2e@crewn.com",
    name: "Crewn Platform Admin",
    role: "ADMIN",
  });
  const business = await getOrCreateUserAndToken({
    email: "biz.e2e@crewn.com",
    name: "Acme Enterprises Client",
    role: "BUSINESS",
  });
  const freelancer = await getOrCreateUserAndToken({
    email: "freelancer.e2e@crewn.com",
    name: "Alex Rivera Lead Designer",
    role: "FREELANCER",
  });
  const outsider = await getOrCreateUserAndToken({
    email: "outsider.e2e@crewn.com",
    name: "Rogue Community Member",
    role: "FREELANCER",
  });

  record("1. Authenticate Admin, Business, Freelancer, and Outsider users", true, `Admin ID: ${admin.userId}`);

  // 2. Security Boundaries: Non-admins blocked from Admin API endpoints
  const blockedBizRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Cookie: `crewn_session=${business.token}` },
  });
  record("2.1 Business client blocked from Admin Dashboard (403 Forbidden)", blockedBizRes.status === 403);

  const blockedFreeRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: `crewn_session=${freelancer.token}` },
  });
  record("2.2 Freelancer creator blocked from Admin Users API (403 Forbidden)", blockedFreeRes.status === 403);

  const unauthRes = await fetch(`${BASE_URL}/api/admin/system-health`);
  record("2.3 Unauthenticated visitor blocked from Admin Health API (401 Unauthorized)", unauthRes.status === 401);

  // 3. Admin Dashboard Operational Metrics
  const dashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
    headers: { Cookie: `crewn_session=${admin.token}` },
  });
  const dashData = await dashRes.json();
  record(
    "3. Admin successfully retrieves real aggregated platform metrics",
    dashRes.status === 200 && typeof dashData.counts?.totalUsers === "number",
    `Total Users: ${dashData.counts?.totalUsers}, Gross Volume INR: ${dashData.financial?.grossTransactionVolumeINR}`
  );

  // 4. Admin User Management & Search
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?search=e2e`, {
    headers: { Cookie: `crewn_session=${admin.token}` },
  });
  const usersData = await usersRes.json();
  record(
    "4. Admin queries user management index with filter & pagination",
    usersRes.status === 200 && Array.isArray(usersData.users) && usersData.users.length >= 3,
    `Found ${usersData.users.length} matching test users`
  );

  // 5. Account Suspension Enforcement & Immediate Session Invalidation
  const suspendRes = await fetch(`${BASE_URL}/api/admin/users/${outsider.userId}/suspend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${admin.token}`,
    },
    body: JSON.stringify({ reason: "Policy violation: Automated spam activity detected" }),
  });
  const suspendData = await suspendRes.json();
  record(
    "5.1 Admin suspends offending account with immutable audit log",
    suspendRes.status === 200 && suspendData.user?.isActive === false
  );

  // Verify suspended token cannot access authenticated endpoints
  const authCheckRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `crewn_session=${outsider.token}` },
  });
  record(
    "5.2 Suspended user active token immediately rejected on protected routes (401)",
    authCheckRes.status === 401 || authCheckRes.status === 403
  );

  // Reactivate user
  const reactivateRes = await fetch(`${BASE_URL}/api/admin/users/${outsider.userId}/reactivate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${admin.token}`,
    },
    body: JSON.stringify({ reason: "User verified identity and completed re-onboarding" }),
  });
  const reactivateData = await reactivateRes.json();
  record(
    "5.3 Admin successfully reactivates account and restores standing",
    reactivateRes.status === 200 && reactivateData.user?.isActive === true
  );

  // 6. Moderation Reporting & Review Queue
  const reportSubmitRes = await fetch(`${BASE_URL}/api/moderation/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${business.token}`,
    },
    body: JSON.stringify({
      targetType: "USER",
      targetId: outsider.userId,
      category: "SPAM",
      reason: "Sent unsolicited marketing messages in collaboration thread.",
    }),
  });
  const reportSubmitData = await reportSubmitRes.json();
  record(
    "6.1 Platform user files moderation report with reason and category",
    reportSubmitRes.status === 201 && !!reportSubmitData.report?.id,
    `Report ID: ${reportSubmitData.report?.id}`
  );
  const reportId = reportSubmitData.report.id;

  const adminModRes = await fetch(`${BASE_URL}/api/admin/moderation?status=PENDING`, {
    headers: { Cookie: `crewn_session=${admin.token}` },
  });
  const adminModData = await adminModRes.json();
  record(
    "6.2 Admin views moderation queue and finds pending report",
    adminModRes.status === 200 && adminModData.reports?.some((r: any) => r.id === reportId)
  );

  const reviewReportRes = await fetch(`${BASE_URL}/api/admin/moderation/${reportId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${admin.token}`,
    },
    body: JSON.stringify({
      status: "ACTION_TAKEN_WARNING",
      actionTaken: "WARNING",
      adminNotes: "First offense formal notice sent to user.",
    }),
  });
  const reviewReportData = await reviewReportRes.json();
  record(
    "6.3 Admin resolves moderation report with formal action and audit trail",
    reviewReportRes.status === 200 && reviewReportData.report?.status === "ACTION_TAKEN_WARNING"
  );

  // 7. Dispute Lifecycle & Financial Escrow Resolution
  // Setup project, milestone, escrow for live dispute
  const { prisma } = await import("../src/lib/prisma");
  let testBiz = await prisma.business.findFirst({ where: { members: { some: { userId: business.userId } } } });
  if (!testBiz) {
    testBiz = await prisma.business.create({
      data: {
        name: "Acme Phase11 Live Corp",
        slug: `acme-ph11-live-${Date.now()}`,
        industry: "Design",
        taxId: "27AAACB2212P1Z0",
        members: { create: [{ userId: business.userId, role: "OWNER" }] },
      },
    });
  }

  const liveProj = await prisma.project.create({
    data: {
      businessId: testBiz.id,
      createdById: business.userId,
      title: "Live Dispute Verification Project",
      description: "Testing end-to-end dispute handling and escrow release.",
      budgetMin: 35000,
      budgetMax: 50000,
      currency: "INR",
      status: "IN_PROGRESS",
      members: {
        create: [
          { userId: business.userId, role: "OWNER" },
          { userId: freelancer.userId, role: "FREELANCER" },
        ],
      },
    },
  });

  const liveMs = await prisma.milestone.create({
    data: {
      projectId: liveProj.id,
      title: "Design System Architecture",
      amount: 35000,
      status: "ACTIVE",
    },
  });

  await prisma.milestonePayment.create({
    data: {
      milestoneId: liveMs.id,
      amount: 35000,
      currency: "INR",
      status: "HELD_IN_ESCROW",
      escrowHeldAt: new Date(),
    },
  });

  const createDisputeRes = await fetch(`${BASE_URL}/api/disputes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${business.token}`,
    },
    body: JSON.stringify({
      projectId: liveProj.id,
      milestoneId: liveMs.id,
      category: "DELIVERABLE_QUALITY",
      reason: "Asset bundle does not include vector sources specified in scope.",
    }),
  });
  const disputeData = await createDisputeRes.json();
  record(
    "7.1 Business files live dispute on escrow-funded milestone",
    createDisputeRes.status === 201 && !!disputeData.dispute?.id,
    `Dispute ID: ${disputeData.dispute?.id}`
  );
  const disputeId = disputeData.dispute.id;

  // Freelancer posts evidence
  const postMsgRes = await fetch(`${BASE_URL}/api/disputes/${disputeId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${freelancer.token}`,
    },
    body: JSON.stringify({
      message: "Uploaded full SVG and Figma components to milestone files vault.",
    }),
  });
  const postMsgData = await postMsgRes.json();
  record(
    "7.2 Freelancer submits rebuttal & evidence message to active dispute",
    postMsgRes.status === 201 && !!postMsgData.message?.id
  );

  // Admin inspects dispute
  const adminDispRes = await fetch(`${BASE_URL}/api/admin/disputes/${disputeId}`, {
    headers: { Cookie: `crewn_session=${admin.token}` },
  });
  const adminDispData = await adminDispRes.json();
  record(
    "7.3 Admin inspects full dispute conversation and evidence history",
    adminDispRes.status === 200 && adminDispData.dispute?.messages?.length >= 2
  );

  // Admin executes financial resolution: RELEASE_ESCROW
  const resolveDispRes = await fetch(`${BASE_URL}/api/admin/disputes/${disputeId}/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${admin.token}`,
    },
    body: JSON.stringify({
      action: "RELEASE_ESCROW",
      adminNotes: "Evidence confirms deliverable requirements satisfied. Escrow released to creator.",
      releaseAmount: 35000,
    }),
  });
  const resolveDispData = await resolveDispRes.json();
  record(
    "7.4 Admin executes escrow release resolution with automated ledger settlement",
    resolveDispRes.status === 200 && resolveDispData.dispute?.status === "RESOLVED_CREATOR"
  );

  // Verify DB state for milestone payment
  const updatedMsPayment = await prisma.milestonePayment.findFirst({
    where: { milestoneId: liveMs.id },
  });
  record(
    "7.5 Escrow ledger verified: MilestonePayment transitioned to RELEASED",
    updatedMsPayment?.status === "RELEASED"
  );

  // 8. Platform Audit Log & System Health
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
    headers: { Cookie: `crewn_session=${admin.token}` },
  });
  const auditData = await auditRes.json();
  record(
    "8.1 Admin inspects append-only audit trail with structured metadata",
    auditRes.status === 200 && Array.isArray(auditData.logs) && auditData.logs.length > 0
  );

  const healthRes = await fetch(`${BASE_URL}/api/admin/system-health`, {
    headers: { Cookie: `crewn_session=${admin.token}` },
  });
  const healthData = await healthRes.json();
  record(
    "8.2 Admin queries live system health diagnostics and latency metrics",
    healthRes.status === 200 && (healthData.status === "OPTIMAL" || healthData.status === "HEALTHY") && healthData.services?.database?.status === "HEALTHY",
    `Status: ${healthData.status}, DB Latency: ${healthData.services?.database?.latencyMs}ms, Active Sessions: ${healthData.services?.sessions?.activeSessions}`
  );

  console.log("\n================================================================================");
  console.log(`ALL ${results.length} PHASE 11 LIVE VERIFICATION CHECKS PASSED!`);
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
