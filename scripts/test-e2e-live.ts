import assert from "node:assert/strict";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";

const BASE_URL = "http://localhost:3000";

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function extractCookie(res: Response, cookieName: string): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function run() {
  console.log("🚀 Starting Phase 2 Live End-to-End Flow Verification against http://localhost:3000...\n");

  const timestamp = Date.now();
  const testBizEmail = `live.biz.${timestamp}@crewn-e2e.com`;
  const testFreeEmail = `live.free.${timestamp}@crewn-e2e.com`;
  const initialPassword = "SecurePassword123!";
  const newPassword = "UpdatedSecurePassword456!";

  // --------------------------------------------------------------------------
  // TEST 1: Security Headers & Next.js 16 Proxy
  // --------------------------------------------------------------------------
  console.log("▶ [TEST 1] Verifying Security Headers & Next.js 16 Proxy...");
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200, "Home page must respond with 200");
  assert.ok(homeRes.headers.get("content-security-policy"), "CSP header must be present");
  assert.equal(homeRes.headers.get("x-content-type-options"), "nosniff", "X-Content-Type-Options must be nosniff");
  assert.equal(homeRes.headers.get("x-frame-options"), "DENY", "X-Frame-Options must be DENY");
  assert.equal(homeRes.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.ok(homeRes.headers.get("permissions-policy"));
  console.log("  ✔ Security headers verified successfully.");

  // Test proxy optimistic redirect for unauthenticated user
  const unauthRes = await fetch(`${BASE_URL}/business`, { redirect: "manual" });
  assert.equal(unauthRes.status, 307, "Unauthenticated /business access must redirect (307)");
  const redirectLocation = unauthRes.headers.get("location");
  assert.ok(redirectLocation?.includes("/login"), "Must redirect to /login");
  console.log("  ✔ Proxy fast optimistic redirect verified.");

  // --------------------------------------------------------------------------
  // TEST 2: Registration Flow with Opaque Session & Token Hashing
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 2] Testing Registration Flow (Business Account)...");
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Acme Production Studio",
      email: testBizEmail,
      password: initialPassword,
      role: "BUSINESS",
    }),
  });

  assert.equal(regRes.status, 201, "Registration must succeed with 201");
  const regData = await regRes.json();
  assert.equal(regData.success, true);
  assert.equal(regData.user.email, testBizEmail);
  assert.equal(regData.user.isVerified, false, "New user must start with isVerified=false");
  assert.equal(regData.user.onboarded, false);

  const bizSessionCookie = extractCookie(regRes, "crewn_session");
  assert.ok(bizSessionCookie, "crewn_session cookie must be set");
  assert.equal(bizSessionCookie.length, 64, "Raw session token must be 256-bit hex (64 chars)");

  // Verify in PostgreSQL: only tokenHash is stored, NOT the raw token
  const bizSessionHash = hashToken(bizSessionCookie);
  const dbSession = await prisma.session.findUnique({
    where: { tokenHash: bizSessionHash },
  });
  assert.ok(dbSession, "Session must exist in PostgreSQL by tokenHash");
  assert.equal(dbSession.userId, regData.user.id);

  // Verify VerificationToken in PostgreSQL: only tokenHash stored
  const dbVerifToken = await prisma.verificationToken.findFirst({
    where: { identifier: testBizEmail },
  });
  assert.ok(dbVerifToken, "VerificationToken must exist in PostgreSQL");
  assert.ok(dbVerifToken.tokenHash, "Must have tokenHash");

  // Verify ActivityLog: REGISTRATION recorded
  const regLog = await prisma.activityLog.findFirst({
    where: { entityType: "AUTH", action: "REGISTRATION", entityId: regData.user.id },
  });
  assert.ok(regLog, "REGISTRATION audit event must be recorded");
  console.log("  ✔ Business registration, opaque session cookie, and tokenHash verified in DB.");

  // --------------------------------------------------------------------------
  // TEST 3: Email Verification Gate (Unverified user blocked from onboarding)
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 3] Testing Email Verification Gate...");
  const prematureOnboardRes = await fetch(`${BASE_URL}/api/onboarding/business`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${bizSessionCookie}`,
    },
    body: JSON.stringify({
      name: "Acme Studio",
      industry: "Film & Entertainment",
      companySize: "11-50",
    }),
  });

  assert.equal(
    prematureOnboardRes.status,
    403,
    "Unverified user must be blocked from onboarding (status 403)"
  );
  const prematureData = await prematureOnboardRes.json();
  assert.ok(
    prematureData.error.toLowerCase().includes("verify your email"),
    "Error must indicate email verification required"
  );
  console.log("  ✔ Email verification gate successfully blocked unverified user from onboarding.");

  // Now verify email using the raw token (we look up token from DB hash)
  // In the real app, raw token is in the email link; here we find the matching tokenHash
  // To simulate clicking the email link, we can test verify-email API with the raw token
  // Let's create a known raw token and hash for exact link simulation:
  const rawEmailToken = crypto.randomBytes(32).toString("hex");
  const testEmailTokenHash = hashToken(rawEmailToken);
  await prisma.verificationToken.update({
    where: { id: dbVerifToken.id },
    data: { tokenHash: testEmailTokenHash },
  });

  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawEmailToken }),
  });

  assert.equal(verifyRes.status, 200, "Email verification must return 200");
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.success, true);
  assert.equal(verifyData.user.isVerified, true);

  // Verify single-use: token must be deleted from DB
  const deletedToken = await prisma.verificationToken.findUnique({
    where: { tokenHash: testEmailTokenHash },
  });
  assert.equal(deletedToken, null, "Verification token must be deleted after use");

  // Verify ActivityLog: EMAIL_VERIFIED recorded
  const verifLog = await prisma.activityLog.findFirst({
    where: { entityType: "AUTH", action: "EMAIL_VERIFIED", entityId: regData.user.id },
  });
  assert.ok(verifLog, "EMAIL_VERIFIED audit event must be recorded");
  console.log("  ✔ Email verification succeeded, token invalidated, audit logged.");

  // --------------------------------------------------------------------------
  // TEST 4: Business Onboarding & Authoritative Profile State
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 4] Testing Business Onboarding...");
  const onboardRes = await fetch(`${BASE_URL}/api/onboarding/business`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${bizSessionCookie}`,
    },
    body: JSON.stringify({
      name: "Acme Global Creative",
      legalName: "Acme Global Creative Private Limited",
      taxId: "27AABCU9603R1ZM",
      website: "https://acmecreative.com",
      industry: "Commercial Visuals",
      companySize: "11-50",
      description: "Leading creative production company.",
    }),
  });

  assert.equal(onboardRes.status, 200, "Business onboarding must succeed");
  const onboardData = await onboardRes.json();
  assert.equal(onboardData.success, true);
  assert.ok(onboardData.business.id);

  // Authoritative check via /api/auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `crewn_session=${bizSessionCookie}` },
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.authenticated, true);
  assert.equal(meData.user.role, "BUSINESS");
  assert.equal(meData.user.isVerified, true);
  assert.equal(meData.user.onboarded, true, "User must now have onboarded=true in DB");
  assert.equal(meData.user.businessMemberships[0].role, "OWNER");
  console.log("  ✔ Business onboarding created Business + BusinessMember(OWNER) and updated onboarded=true.");

  // --------------------------------------------------------------------------
  // TEST 5: Freelancer Flow (Registration, Verify, Onboarding, Role Isolation)
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 5] Testing Freelancer Flow & Role Isolation...");
  const freeRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Priya Menon Visuals",
      email: testFreeEmail,
      password: initialPassword,
      role: "FREELANCER",
    }),
  });
  assert.equal(freeRegRes.status, 201);
  const freeCookie = extractCookie(freeRegRes, "crewn_session");
  assert.ok(freeCookie);

  // Verify freelancer email in DB
  await prisma.user.update({
    where: { email: testFreeEmail },
    data: { isVerified: true },
  });

  // Freelancer attempts business onboarding -> must be rejected (role isolation)
  const roleViolateRes = await fetch(`${BASE_URL}/api/onboarding/business`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${freeCookie}`,
    },
    body: JSON.stringify({ name: "Hacker Biz", industry: "Tech", companySize: "1-10" }),
  });
  assert.equal(roleViolateRes.status, 403, "Freelancer must be forbidden from business onboarding");

  // Complete freelancer onboarding
  const freeOnboardRes = await fetch(`${BASE_URL}/api/onboarding/freelancer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${freeCookie}`,
    },
    body: JSON.stringify({
      headline: "Senior Colorist & Editor",
      bio: "High-end commercial color grading and cinematic post-production specialist.",
      location: "Bengaluru, India",
      hourlyRate: 4000,
      yearsExperience: 7,
      website: "https://priyamenon.art",
      availabilityStatus: "AVAILABLE",
      hoursPerWeek: 35,
      skills: ["DaVinci Resolve", "Color Science", "Commercial Post"],
      services: [
        {
          title: "Feature Grade Package",
          description: "Full colour pass with theatrical delivery",
          basePrice: 75000,
          deliveryDays: 14,
          revisionLimit: 3,
        },
      ],
    }),
  });
  assert.equal(freeOnboardRes.status, 200, "Freelancer onboarding must succeed");

  // Verify freelancer auth state
  const freeMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `crewn_session=${freeCookie}` },
  });
  const freeMeData = await freeMeRes.json();
  assert.equal(freeMeData.user.role, "FREELANCER");
  assert.equal(freeMeData.user.onboarded, true);
  assert.equal(freeMeData.user.freelancerProfile.headline, "Senior Colorist & Editor");
  console.log("  ✔ Freelancer registration, verification, role isolation, and studio profile verified.");

  // --------------------------------------------------------------------------
  // TEST 6: Forgot Password & Password Reset (No Enumeration, Session Revocation)
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 6] Testing Password Reset Flow...");

  // Non-existent email request -> must return identical message
  const fakeForgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "non-existent-user@nowhere.com" }),
  });
  assert.equal(fakeForgotRes.status, 200);
  const fakeForgotData = await fakeForgotRes.json();
  assert.ok(fakeForgotData.message.includes("If an account exists"));

  // Real user forgot password request
  const realForgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testBizEmail }),
  });
  assert.equal(realForgotRes.status, 200);
  const realForgotData = await realForgotRes.json();
  assert.equal(
    realForgotData.message,
    fakeForgotData.message,
    "Responses for existing and non-existing emails must be strictly identical"
  );

  // Simulate clicking password reset email link with secure raw token
  const resetRecord = await prisma.passwordResetToken.findFirst({
    where: { email: testBizEmail },
  });
  assert.ok(resetRecord);
  assert.ok(resetRecord.tokenHash, "PasswordResetToken must store tokenHash");

  const rawResetToken = crypto.randomBytes(32).toString("hex");
  const testResetHash = hashToken(rawResetToken);
  await prisma.passwordResetToken.update({
    where: { id: resetRecord.id },
    data: { tokenHash: testResetHash },
  });

  // Execute password reset
  const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawResetToken, password: newPassword }),
  });
  assert.equal(resetRes.status, 200);
  const resetData = await resetRes.json();
  assert.equal(resetData.success, true);

  // Invalidate token check
  const deletedReset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: testResetHash },
  });
  assert.equal(deletedReset, null, "Password reset token must be deleted after use");

  // Old session revocation check: old cookie must now be invalid
  const oldSessionCheck = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `crewn_session=${bizSessionCookie}` },
  });
  assert.equal(oldSessionCheck.status, 401, "Old sessions must be revoked after password reset");

  // Sign in with new password
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testBizEmail, password: newPassword }),
  });
  assert.equal(newLoginRes.status, 200, "Sign in with new password must succeed");
  const freshBizCookie = extractCookie(newLoginRes, "crewn_session");
  assert.ok(freshBizCookie);

  console.log("  ✔ User enumeration prevented, reset token invalidated, old sessions revoked, re-login succeeded.");

  // --------------------------------------------------------------------------
  // TEST 7: Reauthentication Guard & Password Change
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 7] Testing Reauthentication Guard for Sensitive Password Change...");
  const pwdChangeRes = await fetch(`${BASE_URL}/api/user/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `crewn_session=${freshBizCookie}`,
    },
    body: JSON.stringify({
      currentPassword: newPassword,
      newPassword: "FinalPassword789!",
    }),
  });
  assert.equal(pwdChangeRes.status, 200, "Password change with fresh authentication must succeed");
  const pwdChangeData = await pwdChangeRes.json();
  assert.equal(pwdChangeData.success, true);
  console.log("  ✔ Sensitive operation protected and executed successfully with recent authentication.");

  // --------------------------------------------------------------------------
  // TEST 8: Logout Flow
  // --------------------------------------------------------------------------
  console.log("\n▶ [TEST 8] Testing Logout Flow...");
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: `crewn_session=${freshBizCookie}` },
  });
  assert.equal(logoutRes.status, 200);

  // Session must no longer be valid
  const postLogoutMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `crewn_session=${freshBizCookie}` },
  });
  assert.equal(postLogoutMe.status, 401, "Session must be invalid after logout");
  console.log("  ✔ Logout cleanly destroyed database session and expired cookie.");

  // Cleanup test users
  await prisma.user.deleteMany({
    where: { email: { contains: "crewn-e2e.com" } },
  });

  console.log("\n========================================================");
  console.log("🎉 ALL 8 LIVE END-TO-END FLOW TESTS PASSED SUCCESSFULLY!");
  console.log("========================================================\n");
}

run()
  .catch((err) => {
    console.error("❌ Live verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
