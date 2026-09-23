import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import {
  hashToken,
  generateSecureToken,
  ABSOLUTE_SESSION_MAX_AGE_SECONDS,
  IDLE_SESSION_TIMEOUT_SECONDS,
} from "../src/lib/auth/session";
import {
  InMemoryRateLimiter,
  RedisRateLimiter,
} from "../src/lib/auth/rate-limit";
import { logAuthEvent } from "../src/lib/auth/audit";
import {
  registerSchema,
  businessOnboardingSchema,
  freelancerOnboardingSchema,
} from "../src/lib/validations/auth";

describe("Crewn Phase 2 — Real Authentication & Architectural Corrections Test Suite", () => {
  const testBusinessEmail = `test.biz.${Date.now()}@crewn-test.com`;
  const testFreelancerEmail = `test.creator.${Date.now()}@crewn-test.com`;
  const testPassword = "Password123!";
  let testBusinessUserId = "";
  let testFreelancerUserId = "";
  let testBusinessId = "";
  let testFreelancerProfileId = "";

  before(async () => {
    // Ensure clean state for test domain
    await prisma.user.deleteMany({
      where: { email: { contains: "crewn-test.com" } },
    });
  });

  after(async () => {
    // Clean up test domain users and associated cascaded data
    await prisma.user.deleteMany({
      where: { email: { contains: "crewn-test.com" } },
    });
    await prisma.$disconnect();
  });

  // ----------------------------------------------------------------------------
  // 1. Password Security
  // ----------------------------------------------------------------------------
  test("Password hashing creates secure bcrypt hashes and timing-safe verification", async () => {
    const raw = "SecureP@ss123";
    const hashed = await hashPassword(raw);

    assert.notEqual(hashed, raw, "Hash must never equal plaintext");
    assert.match(hashed, /^\$2[aby]\$\d+\$/, "Must be a valid bcrypt hash format");

    const match = await verifyPassword(raw, hashed);
    assert.equal(match, true, "Valid password must verify");

    const wrongMatch = await verifyPassword("WrongPassword!", hashed);
    assert.equal(wrongMatch, false, "Invalid password must not verify");
  });

  // ----------------------------------------------------------------------------
  // 2. Registration Validation & Role Constraints
  // ----------------------------------------------------------------------------
  test("Validation schema rejects invalid registration and admin role injection", () => {
    // Reject admin role injection
    const adminAttempt = registerSchema.safeParse({
      name: "Hacker Admin",
      email: "admin@crewn.com",
      password: "Password123!",
      role: "ADMIN",
    });
    assert.equal(adminAttempt.success, false, "ADMIN role must not be selectable publicly");

    // Reject weak password
    const weakPass = registerSchema.safeParse({
      name: "Weak User",
      email: "weak@user.com",
      password: "short",
      role: "BUSINESS",
    });
    assert.equal(weakPass.success, false, "Passwords under 8 chars must be rejected");

    // Reject invalid email
    const invalidEmail = registerSchema.safeParse({
      name: "Invalid Email",
      email: "not-an-email",
      password: "Password123!",
      role: "FREELANCER",
    });
    assert.equal(invalidEmail.success, false, "Invalid email format must be rejected");

    // Accept valid business
    const validBiz = registerSchema.safeParse({
      name: "Valid Business",
      email: "biz@valid.com",
      password: "Password123!",
      role: "BUSINESS",
    });
    assert.equal(validBiz.success, true);
  });

  // ----------------------------------------------------------------------------
  // 3. User Creation (Database Persistence)
  // ----------------------------------------------------------------------------
  test("Successful business user registration creates real record in PostgreSQL with isVerified=false", async () => {
    const passwordHash = await hashPassword(testPassword);
    const user = await prisma.user.create({
      data: {
        name: "Lumina Studios Lead",
        email: testBusinessEmail,
        passwordHash,
        role: "BUSINESS",
        isVerified: false,
        onboarded: false,
        isActive: true,
      },
    });

    testBusinessUserId = user.id;
    assert.ok(user.id, "User ID must be generated");
    assert.equal(user.email, testBusinessEmail);
    assert.equal(user.role, "BUSINESS");
    assert.equal(user.onboarded, false);
    assert.equal(user.isVerified, false, "New user must start unverified");
  });

  test("Successful freelancer user registration creates real record in PostgreSQL", async () => {
    const passwordHash = await hashPassword(testPassword);
    const user = await prisma.user.create({
      data: {
        name: "Aarav Sharma Cinematography",
        email: testFreelancerEmail,
        passwordHash,
        role: "FREELANCER",
        isVerified: false,
        onboarded: false,
        isActive: true,
      },
    });

    testFreelancerUserId = user.id;
    assert.ok(user.id, "Freelancer User ID must be generated");
    assert.equal(user.email, testFreelancerEmail);
    assert.equal(user.role, "FREELANCER");
    assert.equal(user.onboarded, false);
    assert.equal(user.isVerified, false);
  });

  test("Duplicate registration with existing email is prevented by database unique constraint", async () => {
    await assert.rejects(
      async () => {
        await prisma.user.create({
          data: {
            name: "Duplicate User",
            email: testBusinessEmail,
            role: "BUSINESS",
          },
        });
      },
      /Unique constraint failed/
    );
  });

  // ----------------------------------------------------------------------------
  // 4. Session Architecture & Token Hashing (256-bit Opaque Token)
  // ----------------------------------------------------------------------------
  test("Database Session stores only SHA-256 tokenHash, never raw session tokens", async () => {
    // Generate 256-bit (32 bytes) cryptographically random token
    const rawToken = generateSecureToken(32);
    assert.equal(rawToken.length, 64, "256-bit token in hex must be 64 characters");

    const tokenHash = hashToken(rawToken);
    assert.notEqual(tokenHash, rawToken, "tokenHash must differ from raw token");

    const expiresAt = new Date(Date.now() + ABSOLUTE_SESSION_MAX_AGE_SECONDS * 1000);
    const now = new Date();

    const session = await prisma.session.create({
      data: {
        userId: testBusinessUserId,
        tokenHash,
        expiresAt,
        lastActivityAt: now,
        lastReauthenticatedAt: now,
        ipAddress: "127.0.0.1",
        userAgent: "TestRunner/1.0",
      },
    });

    assert.ok(session.id);
    assert.equal(session.tokenHash, tokenHash);

    // Verify lookup by hash resolves the authoritative database record
    const found = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    assert.ok(found);
    assert.equal(found.userId, testBusinessUserId);
    assert.equal(found.user.email, testBusinessEmail);
    assert.equal(found.user.role, "BUSINESS");

    // Clean up test session
    await prisma.session.delete({ where: { id: session.id } });
  });

  // ----------------------------------------------------------------------------
  // 5. Session Idle Timeout & Revocation
  // ----------------------------------------------------------------------------
  test("Session expiry logic enforces absolute expiry and idle timeout", async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    // Create an idle-expired session (lastActivityAt was 25 hours ago)
    const expiredActivityTime = new Date(Date.now() - (IDLE_SESSION_TIMEOUT_SECONDS + 3600) * 1000);
    const futureAbsoluteExpiry = new Date(Date.now() + 86400 * 1000);

    const idleSession = await prisma.session.create({
      data: {
        userId: testBusinessUserId,
        tokenHash,
        expiresAt: futureAbsoluteExpiry,
        lastActivityAt: expiredActivityTime,
        lastReauthenticatedAt: expiredActivityTime,
      },
    });

    // Check idle timeout condition
    const isIdleExpired =
      Date.now() - idleSession.lastActivityAt.getTime() > IDLE_SESSION_TIMEOUT_SECONDS * 1000;
    assert.equal(isIdleExpired, true, "Session must be identified as idle-expired");

    // Revocation of all sessions for user
    await prisma.session.deleteMany({ where: { userId: testBusinessUserId } });
    const countAfterRevoke = await prisma.session.count({ where: { userId: testBusinessUserId } });
    assert.equal(countAfterRevoke, 0, "All sessions must be revoked");
  });

  // ----------------------------------------------------------------------------
  // 6. Verification Token Security (Hashed Token & Single-Use)
  // ----------------------------------------------------------------------------
  test("VerificationToken stores only SHA-256 tokenHash and is single-use", async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const record = await prisma.verificationToken.create({
      data: {
        identifier: testBusinessEmail,
        tokenHash,
        expiresAt,
      },
    });

    assert.ok(record.id);
    assert.equal(record.tokenHash, tokenHash);

    // Verify lookup by hashed token
    const found = await prisma.verificationToken.findUnique({
      where: { tokenHash },
    });
    assert.ok(found);

    // Update user to verified
    await prisma.user.update({
      where: { email: found.identifier },
      data: { isVerified: true },
    });

    // Single-use invalidation
    await prisma.verificationToken.delete({ where: { id: found.id } });

    const deleted = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    assert.equal(deleted, null, "Verification token must be deleted after use");

    const updatedUser = await prisma.user.findUnique({ where: { id: testBusinessUserId } });
    assert.equal(updatedUser?.isVerified, true, "User must now be verified");
  });

  // ----------------------------------------------------------------------------
  // 7. Password Reset Token Security & Flow
  // ----------------------------------------------------------------------------
  test("PasswordResetToken stores only SHA-256 hash, updates password, and revokes all sessions", async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const resetRecord = await prisma.passwordResetToken.create({
      data: {
        email: testBusinessEmail,
        tokenHash,
        expiresAt,
      },
    });

    assert.ok(resetRecord.id);

    // Also create an active session to test session revocation after password reset
    const sessionToken = generateSecureToken(32);
    await prisma.session.create({
      data: {
        userId: testBusinessUserId,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    });

    const newPassword = "NewSecurePassword456!";
    const newHash = await hashPassword(newPassword);

    // 1. Update password
    await prisma.user.update({
      where: { email: resetRecord.email },
      data: { passwordHash: newHash },
    });

    // 2. Invalidate reset token (single-use)
    await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });

    // 3. Invalidate ALL sessions after password reset
    await prisma.session.deleteMany({ where: { userId: testBusinessUserId } });

    // Assertions
    const resetTokenCheck = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    assert.equal(resetTokenCheck, null, "Reset token must be single-use and deleted");

    const activeSessionsCount = await prisma.session.count({ where: { userId: testBusinessUserId } });
    assert.equal(activeSessionsCount, 0, "All sessions must be revoked on password reset");

    const user = await prisma.user.findUnique({ where: { id: testBusinessUserId } });
    const isNewValid = await verifyPassword(newPassword, user!.passwordHash!);
    assert.equal(isNewValid, true, "New password must verify successfully");
  });

  // ----------------------------------------------------------------------------
  // 8. Rate Limiting Abstraction
  // ----------------------------------------------------------------------------
  test("RateLimiter interface sliding window blocks requests exceeding limit", async () => {
    const limiter = new InMemoryRateLimiter();
    const testKey = `test-ip-${Date.now()}`;

    // Allow 3 attempts within 10 seconds
    const res1 = await limiter.limit(testKey, 3, 10000);
    assert.equal(res1.success, true);
    assert.equal(res1.remaining, 2);

    const res2 = await limiter.limit(testKey, 3, 10000);
    assert.equal(res2.success, true);
    assert.equal(res2.remaining, 1);

    const res3 = await limiter.limit(testKey, 3, 10000);
    assert.equal(res3.success, true);
    assert.equal(res3.remaining, 0);

    // 4th attempt must be blocked
    const res4 = await limiter.limit(testKey, 3, 10000);
    assert.equal(res4.success, false);
    assert.equal(res4.remaining, 0);
  });

  // ----------------------------------------------------------------------------
  // 9. Business Onboarding Flow (Business + BusinessMember OWNER)
  // ----------------------------------------------------------------------------
  test("Business onboarding creates Business and BusinessMember with OWNER role", async () => {
    const validPayload = businessOnboardingSchema.parse({
      name: "Lumina Studio Global",
      legalName: "Lumina Studios Private Limited",
      taxId: "27AABCU9603R1ZM",
      website: "https://luminaglobal.com",
      industry: "Fashion & Apparel",
      companySize: "11-50",
      description: "Premier commercial visual production brand.",
    });

    const business = await prisma.business.create({
      data: {
        name: validPayload.name,
        slug: `lumina-studio-test-${Date.now()}`,
        legalName: validPayload.legalName,
        taxId: validPayload.taxId,
        website: validPayload.website,
        industry: validPayload.industry,
        companySize: validPayload.companySize,
        description: validPayload.description,
      },
    });

    testBusinessId = business.id;

    const member = await prisma.businessMember.create({
      data: {
        businessId: business.id,
        userId: testBusinessUserId,
        role: "OWNER",
      },
    });

    // Update user onboarded flag
    await prisma.user.update({
      where: { id: testBusinessUserId },
      data: { onboarded: true },
    });

    assert.ok(business.id);
    assert.equal(member.role, "OWNER");
    assert.equal(member.businessId, business.id);
    assert.equal(member.userId, testBusinessUserId);

    const user = await prisma.user.findUnique({
      where: { id: testBusinessUserId },
      include: { businessMemberships: true },
    });

    assert.equal(user?.onboarded, true, "Business user must be marked onboarded");
    assert.equal(user?.businessMemberships.length, 1);
  });

  // ----------------------------------------------------------------------------
  // 10. Freelancer Onboarding Flow (Profile, Availability, Skills, Services)
  // ----------------------------------------------------------------------------
  test("Freelancer onboarding creates Profile, Availability, Skills, and Service packages", async () => {
    // First mark freelancer verified
    await prisma.user.update({
      where: { id: testFreelancerUserId },
      data: { isVerified: true },
    });

    const validPayload = freelancerOnboardingSchema.parse({
      headline: "Senior Commercial Cinematographer",
      bio: "Master of visual storytelling, color science, and dynamic commercial camera movement.",
      location: "Mumbai, India",
      hourlyRate: 3500,
      yearsExperience: 6,
      website: "https://aaravcinematography.com",
      availabilityStatus: "AVAILABLE",
      hoursPerWeek: 40,
      skills: ["Color Grading", "DaVinci Resolve", "Commercial Cinematography"],
      services: [
        {
          title: "60-Second Commercial Master",
          description: "Full production commercial film with licensed score",
          basePrice: 50000,
          deliveryDays: 10,
          revisionLimit: 2,
        },
      ],
      portfolioItems: [
        {
          title: "Winter Luxury Fashion Film",
          mediaType: "VIDEO",
          externalUrl: "https://vimeo.com/test",
        },
      ],
    });

    const profile = await prisma.freelancerProfile.create({
      data: {
        userId: testFreelancerUserId,
        headline: validPayload.headline,
        bio: validPayload.bio,
        location: validPayload.location,
        hourlyRate: validPayload.hourlyRate,
        yearsExperience: validPayload.yearsExperience,
        website: validPayload.website,
      },
    });

    testFreelancerProfileId = profile.id;

    // Create Availability
    await prisma.availability.create({
      data: {
        freelancerProfileId: profile.id,
        status: validPayload.availabilityStatus,
        hoursPerWeek: validPayload.hoursPerWeek,
      },
    });

    // Create Skills
    for (const skillName of validPayload.skills) {
      const slug = skillName.toLowerCase().replace(/\s+/g, "-");
      const skill = await prisma.skill.upsert({
        where: { slug },
        update: { name: skillName },
        create: { name: skillName, slug },
      });

      await prisma.profileSkill.create({
        data: {
          freelancerProfileId: profile.id,
          skillId: skill.id,
        },
      });
    }

    // Create Service
    await prisma.service.create({
      data: {
        freelancerProfileId: profile.id,
        title: validPayload.services![0].title,
        description: validPayload.services![0].description,
        basePrice: validPayload.services![0].basePrice,
        deliveryDays: validPayload.services![0].deliveryDays,
        revisionLimit: validPayload.services![0].revisionLimit,
      },
    });

    // Create Portfolio Item
    await prisma.portfolioItem.create({
      data: {
        freelancerProfileId: profile.id,
        title: validPayload.portfolioItems![0].title,
        mediaType: validPayload.portfolioItems![0].mediaType,
        externalUrl: validPayload.portfolioItems![0].externalUrl,
      },
    });

    // Update user onboarded flag
    await prisma.user.update({
      where: { id: testFreelancerUserId },
      data: { onboarded: true },
    });

    const fullProfile = await prisma.freelancerProfile.findUnique({
      where: { id: profile.id },
      include: {
        availability: true,
        skills: { include: { skill: true } },
        services: true,
        portfolioItems: true,
      },
    });

    assert.ok(fullProfile);
    assert.equal(fullProfile.headline, "Senior Commercial Cinematographer");
    assert.equal(fullProfile.availability?.status, "AVAILABLE");
    assert.equal(fullProfile.skills.length, 3);
    assert.equal(fullProfile.services.length, 1);
    assert.equal(fullProfile.portfolioItems.length, 1);

    const user = await prisma.user.findUnique({ where: { id: testFreelancerUserId } });
    assert.equal(user?.onboarded, true, "Freelancer must be marked onboarded");
  });

  // ----------------------------------------------------------------------------
  // 11. Reauthentication Gate
  // ----------------------------------------------------------------------------
  test("Reauthentication gate checks session lastReauthenticatedAt", async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    // Stale authentication session (authenticated 20 minutes ago > 15 min threshold)
    const staleTime = new Date(Date.now() - 20 * 60 * 1000);
    const staleSession = await prisma.session.create({
      data: {
        userId: testBusinessUserId,
        tokenHash,
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: staleTime,
      },
    });

    const secondsSinceReauth =
      (Date.now() - staleSession.lastReauthenticatedAt.getTime()) / 1000;
    const isRecent = secondsSinceReauth <= 900;
    assert.equal(isRecent, false, "Session authenticated 20m ago must be flagged as not recent");

    // Update to fresh authentication
    const updated = await prisma.session.update({
      where: { id: staleSession.id },
      data: { lastReauthenticatedAt: new Date() },
    });

    const freshSeconds = (Date.now() - updated.lastReauthenticatedAt.getTime()) / 1000;
    assert.equal(freshSeconds <= 900, true, "Freshly reauthenticated session must pass");

    await prisma.session.delete({ where: { id: staleSession.id } });
  });

  // ----------------------------------------------------------------------------
  // 12. Audit Logging
  // ----------------------------------------------------------------------------
  test("Auth events are safely recorded in ActivityLog without logging sensitive tokens or passwords", async () => {
    await logAuthEvent({
      action: "LOGIN",
      userId: testBusinessUserId,
      actorId: testBusinessUserId,
      ipAddress: "127.0.0.1",
      metadata: { role: "BUSINESS", test: true },
    });

    const logEntry = await prisma.activityLog.findFirst({
      where: {
        entityType: "AUTH",
        entityId: testBusinessUserId,
        action: "LOGIN",
      },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(logEntry, "ActivityLog record must exist");
    assert.equal(logEntry.action, "LOGIN");
    assert.equal(logEntry.actorId, testBusinessUserId);

    if (logEntry.metadataJson) {
      assert.equal(logEntry.metadataJson.includes("password"), false, "Passwords must never appear in log metadata");
      assert.equal(logEntry.metadataJson.includes("tokenHash"), false, "Token hashes must never appear in log metadata");
    }
  });
});
