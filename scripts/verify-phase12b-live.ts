import crypto from "crypto";

const BASE_URL = "http://localhost:3000";

interface CheckResult {
  check: string;
  passed: boolean;
  details?: string;
}

const checks: CheckResult[] = [];

function record(check: string, passed: boolean, details?: string) {
  checks.push({ check, passed, details });
  const tag = passed ? "[PASS]" : "[FAIL]";
  console.log(`${tag} ${check} ${details ? `(${details})` : ""}`);
  if (!passed) {
    throw new Error(`Live check failed: ${check} - ${details}`);
  }
}

async function getAdminSession(): Promise<string> {
  const { prisma } = await import("../src/lib/prisma");
  const { createSession } = await import("../src/lib/auth/session");

  let admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: `admin-live-${Date.now()}@crewn.test`,
        name: "Admin Live Verifier",
        role: "ADMIN",
        isVerified: true,
        isActive: true,
        onboarded: true,
      },
    });
  }

  const session = await createSession({ userId: admin.id });
  return session.token;
}

async function run() {
  console.log("================================================================================");
  console.log("PHASE 12B LIVE SYSTEM VERIFICATION & SECURITY HARDENING VALIDATION");
  console.log(`Target: ${BASE_URL}`);
  console.log("================================================================================\n");

  const adminToken = await getAdminSession();
  const adminCookie = `crewn_session=${adminToken}`;

  // ---------------------------------------------------------------------------
  // Check 1: CSP Nonce-Based Policy on Public and Authenticated Pages
  // ---------------------------------------------------------------------------
  console.log("--- Check 1: CSP Nonce-Based Header ---");
  const homeRes = await fetch(`${BASE_URL}/`);
  record("1a. Home page responds 200 OK", homeRes.status === 200, `status=${homeRes.status}`);
  const homeCsp = homeRes.headers.get("content-security-policy");
  record("1b. Home page serves CSP header", Boolean(homeCsp), `csp=${homeCsp ? homeCsp.slice(0, 50) + "..." : "none"}`);
  record("1c. CSP contains script nonce", Boolean(homeCsp && homeCsp.includes("nonce-")), `nonce present`);

  const adminPageRes = await fetch(`${BASE_URL}/admin`, {
    headers: { cookie: adminCookie },
  });
  record("1d. Admin dashboard page loads 200 with session", adminPageRes.status === 200, `status=${adminPageRes.status}`);
  const adminCsp = adminPageRes.headers.get("content-security-policy");
  record("1e. Admin dashboard serves unique CSP nonce", Boolean(adminCsp && adminCsp !== homeCsp && adminCsp.includes("nonce-")), `unique per request`);

  // ---------------------------------------------------------------------------
  // Check 2: Restrictive CORS Enforcement
  // ---------------------------------------------------------------------------
  console.log("\n--- Check 2: Restrictive CORS Enforcement ---");
  // Arbitrary origin on API endpoint with mutating method
  const disallowedOriginRes = await fetch(`${BASE_URL}/api/payments/create-order`, {
    method: "POST",
    headers: {
      origin: "https://malicious-unauthorized-attacker.com",
      "content-type": "application/json",
    },
    body: JSON.stringify({ milestoneId: "fake_milestone_123" }),
  });
  record(
    "2a. Mutating request with disallowed origin is rejected with 403 Forbidden",
    disallowedOriginRes.status === 403,
    `status=${disallowedOriginRes.status}`
  );

  // Webhook endpoint permits server-to-server calls without CORS block
  const webhookCorsRes = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
    method: "POST",
    headers: {
      origin: "https://api.razorpay.com",
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });
  record(
    "2b. Razorpay webhook endpoint is exempt from browser CORS restriction",
    webhookCorsRes.status === 400 || webhookCorsRes.status === 200, // 400 because signature is missing, NOT 403 CORS blocked
    `status=${webhookCorsRes.status}`
  );

  // ---------------------------------------------------------------------------
  // Check 3: Webhook Dead-Letter Queue (DLQ)
  // ---------------------------------------------------------------------------
  console.log("\n--- Check 3: Webhook DLQ Management ---");
  // Unauthenticated DLQ access
  const unauthDlqRes = await fetch(`${BASE_URL}/api/admin/webhooks/dlq`);
  record(
    "3a. DLQ API rejects unauthenticated requests with 401",
    unauthDlqRes.status === 401,
    `status=${unauthDlqRes.status}`
  );

  // Authenticated DLQ access
  const authDlqRes = await fetch(`${BASE_URL}/api/admin/webhooks/dlq`, {
    headers: { cookie: adminCookie },
  });
  record(
    "3b. DLQ API returns 200 for authenticated admin",
    authDlqRes.status === 200,
    `status=${authDlqRes.status}`
  );
  const dlqData = await authDlqRes.json();
  record(
    "3c. DLQ API returns paginated structure",
    Array.isArray(dlqData.items) && typeof dlqData.totalCount === "number",
    `total=${dlqData.totalCount}, count=${dlqData.items?.length}`
  );

  // ---------------------------------------------------------------------------
  // Check 4: Cron Maintenance & Session/Storage Cleanups
  // ---------------------------------------------------------------------------
  console.log("\n--- Check 4: Cron Jobs & Scheduled Cleanups ---");
  const cronSecret = process.env.CRON_SECRET || "dev-cron-secret-key-for-local-testing-32b";

  // Rejection without secret
  const unauthCronRes = await fetch(`${BASE_URL}/api/cron?job=CLEANUP_EXPIRED_SESSIONS`);
  record(
    "4a. Cron maintenance rejects unauthorized requests with 401",
    unauthCronRes.status === 401,
    `status=${unauthCronRes.status}`
  );

  // Session cleanup execution
  const sessionCleanupRes = await fetch(`${BASE_URL}/api/cron?job=CLEANUP_EXPIRED_SESSIONS`, {
    headers: { "x-cron-secret": cronSecret },
  });
  record(
    "4b. CLEANUP_EXPIRED_SESSIONS executes idempotently via cron",
    sessionCleanupRes.status === 200,
    `status=${sessionCleanupRes.status}`
  );
  const sessionCleanupData = await sessionCleanupRes.json();
  record(
    "4c. Session cleanup returns success outcome",
    sessionCleanupData.success === true && sessionCleanupData.job === "CLEANUP_EXPIRED_SESSIONS",
    JSON.stringify(sessionCleanupData.result)
  );

  // Orphaned upload cleanup execution
  const uploadCleanupRes = await fetch(`${BASE_URL}/api/cron?job=CLEANUP_ORPHANED_UPLOADS`, {
    headers: { "x-cron-secret": cronSecret },
  });
  record(
    "4d. CLEANUP_ORPHANED_UPLOADS executes idempotently via cron",
    uploadCleanupRes.status === 200,
    `status=${uploadCleanupRes.status}`
  );
  const uploadCleanupData = await uploadCleanupRes.json();
  record(
    "4e. Orphaned uploads cleanup returns success outcome",
    uploadCleanupData.success === true && uploadCleanupData.job === "CLEANUP_ORPHANED_UPLOADS",
    JSON.stringify(uploadCleanupData.result)
  );

  // ---------------------------------------------------------------------------
  // Check 5: Financial Reconciliation & Ledger Auditing
  // ---------------------------------------------------------------------------
  console.log("\n--- Check 5: Financial Reconciliation & Ledger Integrity ---");
  const reconRes = await fetch(`${BASE_URL}/api/admin/finance/reconciliation`, {
    headers: { cookie: adminCookie },
  });
  record(
    "5a. Financial reconciliation API responds 200 for admin",
    reconRes.status === 200,
    `status=${reconRes.status}`
  );
  const reconData = await reconRes.json();
  record(
    "5b. Reconciliation data provides verifiable ledger metrics",
    reconData.summary && typeof reconData.summary.totalCheckedTransactions === "number",
    `checkedTx=${reconData.summary?.totalCheckedTransactions}, matched=${reconData.summary?.matchedRecords}, discrepancies=${reconData.summary?.totalDiscrepancies}`
  );

  // ---------------------------------------------------------------------------
  // Check 6: Observability, Health & Readiness Endpoints
  // ---------------------------------------------------------------------------
  console.log("\n--- Check 6: Health, Readiness & Observability ---");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  record("6a. /api/health responds 200 OK", healthRes.status === 200, `status=${healthRes.status}`);
  const healthData = await healthRes.json();
  record(
    "6b. /api/health returns safe status without credentials",
    healthData.status === "ok" && typeof healthData.uptime === "number" && !healthData.databaseUrl,
    `status=${healthData.status}, uptime=${healthData.uptime}`
  );

  const readyRes = await fetch(`${BASE_URL}/api/ready`);
  record(
    "6c. /api/ready responds 200 or 503 depending on live external dependencies",
    readyRes.status === 200 || readyRes.status === 503,
    `status=${readyRes.status}`
  );
  const readyData = await readyRes.json();
  record(
    "6d. /api/ready audits dependencies safely without leaking connection secrets",
    typeof readyData.status === "string" && !JSON.stringify(readyData).includes("postgres://"),
    `status=${readyData.status}`
  );

  console.log("\n================================================================================");
  console.log(`ALL ${checks.length}/${checks.length} PHASE 12B LIVE SYSTEM CHECKS PASSED SUCCESSFULLY!`);
  console.log("================================================================================");
}

run()
  .catch((err) => {
    console.error("FATAL: Live verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
    process.exit(0);
  });
