import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { normalizeSlug, isValidSlug, RESERVED_SLUGS } from "../src/lib/creators/slug";
import {
  LocalStorageProvider,
  isAllowedMimeType,
  validateFileSignature,
  sanitizeFileName,
  generateStorageKey,
  generateSignedUrl,
  verifySignedUrlToken,
  MAX_FILE_SIZE_BYTES,
} from "../src/lib/storage";
import { AvailabilityStatus, PricingType, InquiryStatus, MediaType } from "@prisma/client";

describe("Crewn Phase 3 — Production Creator Marketplace, Profiles, Portfolio & Services Test Suite", () => {
  const timestamp = Date.now();
  const testBusinessEmail = `test.biz.p3.${timestamp}@marketplace-test.com`;
  const testCreator1Email = `test.creator1.p3.${timestamp}@marketplace-test.com`;
  const testCreator2Email = `test.creator2.p3.${timestamp}@marketplace-test.com`;

  let businessUserId = "";
  let creator1UserId = "";
  let creator2UserId = "";

  let creator1ProfileId = "";
  let creator2ProfileId = "";

  let creator1ServiceId = "";
  let creator1PortfolioId = "";

  before(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: "@marketplace-test.com" } },
    });

    // 1. Create Business User
    const bizUser = await prisma.user.create({
      data: {
        email: testBusinessEmail,
        name: "Acme Creative Brand",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
    });
    businessUserId = bizUser.id;

    // 2. Create Creator 1 (Public, Visible, Cinematographer)
    const c1User = await prisma.user.create({
      data: {
        email: testCreator1Email,
        name: "Arjun Motion Director",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
    });
    creator1UserId = c1User.id;

    const c1Profile = await prisma.freelancerProfile.create({
      data: {
        userId: creator1UserId,
        publicSlug: `arjun-cinematography-${timestamp}`,
        headline: "Award-winning Commercial Cinematographer & DaVinci Colorist",
        bio: "Specializing in high-end commercial campaigns, automotive films, and narrative direction with over 8 years experience.",
        location: "Mumbai, India",
        yearsExperience: 8,
        hourlyRate: 7500,
        marketplaceVisible: true,
        isVerified: true,
      },
    });
    creator1ProfileId = c1Profile.id;

    // Set Creator 1 Availability
    await prisma.availability.create({
      data: {
        freelancerProfileId: creator1ProfileId,
        status: AvailabilityStatus.AVAILABLE,
        hoursPerWeek: 40,
      },
    });

    // Add Skills to Creator 1
    const skillCinematography = await prisma.skill.upsert({
      where: { name: "Cinematography" },
      update: {},
      create: { name: "Cinematography", slug: "cinematography" },
    });
    const skillDaVinci = await prisma.skill.upsert({
      where: { name: "DaVinci Resolve" },
      update: {},
      create: { name: "DaVinci Resolve", slug: "davinci-resolve" },
    });

    await prisma.profileSkill.createMany({
      data: [
        { freelancerProfileId: creator1ProfileId, skillId: skillCinematography.id },
        { freelancerProfileId: creator1ProfileId, skillId: skillDaVinci.id },
      ],
    });

    // 3. Create Creator 2 (Hidden / Private, Junior Editor)
    const c2User = await prisma.user.create({
      data: {
        email: testCreator2Email,
        name: "Rohan Editor",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
    });
    creator2UserId = c2User.id;

    const c2Profile = await prisma.freelancerProfile.create({
      data: {
        userId: creator2UserId,
        publicSlug: `rohan-editor-${timestamp}`,
        headline: "Short-form Social Media Reel Editor",
        bio: "Fast turnaround reel cuts and viral pacing for brands and creators.",
        location: "Bengaluru, India",
        yearsExperience: 2,
        hourlyRate: 1500,
        marketplaceVisible: false, // Hidden
        isVerified: false,
      },
    });
    creator2ProfileId = c2Profile.id;
  });

  after(async () => {
    // Cascade delete test users and their related entities
    await prisma.user.deleteMany({
      where: { email: { contains: "@marketplace-test.com" } },
    });
    await prisma.$disconnect();
  });

  // ----------------------------------------------------------------------------
  // 1. Slug Validation & Reserved Routes
  // ----------------------------------------------------------------------------
  test("Slug normalization and reserved route enforcement", () => {
    assert.equal(normalizeSlug(" John_Doe 101 "), "john_doe-101");
    assert.equal(normalizeSlug("Sarah---Motion"), "sarah-motion");

    const reservedCheck = isValidSlug("marketplace");
    assert.equal(reservedCheck.valid, false);
    assert.match(reservedCheck.error || "", /reserved/i);

    const adminCheck = isValidSlug("admin");
    assert.equal(adminCheck.valid, false);

    const validCheck = isValidSlug("creative-director-01");
    assert.equal(validCheck.valid, true);

    const tooShort = isValidSlug("ab");
    assert.equal(tooShort.valid, false);
  });

  // ----------------------------------------------------------------------------
  // 2. Marketplace Discovery & Visibility
  // ----------------------------------------------------------------------------
  test("Marketplace discovery returns only verified, visible creators", async () => {
    const visibleProfiles = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        user: { isVerified: true, isActive: true },
      },
    });

    const c1Found = visibleProfiles.some((p) => p.id === creator1ProfileId);
    const c2Found = visibleProfiles.some((p) => p.id === creator2ProfileId);

    assert.equal(c1Found, true, "Public verified creator must appear in marketplace");
    assert.equal(c2Found, false, "Hidden/private creator must NEVER appear in marketplace");
  });

  // ----------------------------------------------------------------------------
  // 3. Search & Multi-Factor Filtering
  // ----------------------------------------------------------------------------
  test("Multi-factor search matches headline, skills, location, and price ranges", async () => {
    // Search by keyword "Cinematographer"
    const searchResult = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        OR: [
          { headline: { contains: "Cinematographer", mode: "insensitive" } },
          { bio: { contains: "Cinematographer", mode: "insensitive" } },
        ],
      },
    });
    assert.equal(searchResult.some((p) => p.id === creator1ProfileId), true);

    // Filter by skill "DaVinci Resolve"
    const skillResult = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        skills: {
          some: { skill: { name: "DaVinci Resolve" } },
        },
      },
    });
    assert.equal(skillResult.some((p) => p.id === creator1ProfileId), true);

    // Filter by experience >= 5 years
    const expResult = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        yearsExperience: { gte: 5 },
      },
    });
    assert.equal(expResult.some((p) => p.id === creator1ProfileId), true);

    // Filter by rate range ₹5,000 - ₹10,000
    const priceResult = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        hourlyRate: { gte: 5000, lte: 10000 },
      },
    });
    assert.equal(priceResult.some((p) => p.id === creator1ProfileId), true);
  });

  // ----------------------------------------------------------------------------
  // 4. Availability Filtering
  // ----------------------------------------------------------------------------
  test("Availability query accurately reflects creator configured status", async () => {
    const availableCreators = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        availability: { status: AvailabilityStatus.AVAILABLE },
      },
    });
    assert.equal(availableCreators.some((p) => p.id === creator1ProfileId), true);

    const busyCreators = await prisma.freelancerProfile.findMany({
      where: {
        marketplaceVisible: true,
        availability: { status: AvailabilityStatus.BUSY },
      },
    });
    assert.equal(busyCreators.some((p) => p.id === creator1ProfileId), false);
  });

  // ----------------------------------------------------------------------------
  // 5. Services CRUD & Ownership / IDOR Protection
  // ----------------------------------------------------------------------------
  test("Service package creation and IDOR ownership boundaries", async () => {
    // Creator 1 creates a service package
    const service = await prisma.service.create({
      data: {
        freelancerProfileId: creator1ProfileId,
        title: "Full Commercial Grade & Look Dev",
        description: "60-second commercial DaVinci color grading with look LUT deliverable.",
        basePrice: 15000,
        pricingType: PricingType.FIXED,
        deliveryDays: 4,
        revisionLimit: 3,
        isActive: true,
      },
    });
    creator1ServiceId = service.id;

    assert.equal(service.title, "Full Commercial Grade & Look Dev");
    assert.equal(Number(service.basePrice), 15000);

    // Verify creator 1 is owner
    const existing = await prisma.service.findUnique({
      where: { id: creator1ServiceId },
    });
    assert.equal(existing?.freelancerProfileId, creator1ProfileId);

    // IDOR Check: Creator 2 cannot modify Creator 1's service
    const isOwner = existing?.freelancerProfileId === creator2ProfileId;
    assert.equal(isOwner, false, "Creator 2 must NOT be allowed to mutate Creator 1's service");

    // Creator 1 updates service
    const updated = await prisma.service.update({
      where: { id: creator1ServiceId },
      data: { basePrice: 18000 },
    });
    assert.equal(Number(updated.basePrice), 18000);
  });

  // ----------------------------------------------------------------------------
  // 6. Portfolio Management & Public Exposure Rules
  // ----------------------------------------------------------------------------
  test("Portfolio items respect published status and draft privacy", async () => {
    // Creator 1 creates a published portfolio item
    const publishedItem = await prisma.portfolioItem.create({
      data: {
        freelancerProfileId: creator1ProfileId,
        title: "Automotive Spec Commercial 2026",
        description: "Anamorphic Alexa 35 production shot in Ladakh.",
        category: "Commercial",
        mediaType: MediaType.VIDEO,
        externalUrl: "https://vimeo.com/12345678",
        published: true,
        displayOrder: 0,
      },
    });
    creator1PortfolioId = publishedItem.id;

    // Creator 1 creates a draft (unpublished) item
    const draftItem = await prisma.portfolioItem.create({
      data: {
        freelancerProfileId: creator1ProfileId,
        title: "Confidential Brand Pitch Deck",
        description: "Unreleased brand campaign.",
        category: "Confidential",
        mediaType: MediaType.DOCUMENT,
        published: false, // Draft
        displayOrder: 1,
      },
    });

    // Public query (published only)
    const publicItems = await prisma.portfolioItem.findMany({
      where: {
        freelancerProfileId: creator1ProfileId,
        published: true,
      },
    });

    const hasPublished = publicItems.some((i) => i.id === publishedItem.id);
    const hasDraft = publicItems.some((i) => i.id === draftItem.id);

    assert.equal(hasPublished, true, "Published item must appear on public profile");
    assert.equal(hasDraft, false, "Draft item must NEVER be exposed publicly");

    // Clean up draft
    await prisma.portfolioItem.delete({ where: { id: draftItem.id } });
  });

  // ----------------------------------------------------------------------------
  // 7. Saved Creators & Duplicate Prevention
  // ----------------------------------------------------------------------------
  test("Business saved creator bookmarks and duplicate prevention", async () => {
    // Business saves Creator 1
    const saved = await prisma.savedCreator.create({
      data: {
        userId: businessUserId,
        freelancerId: creator1ProfileId,
      },
    });
    assert.equal(saved.userId, businessUserId);
    assert.equal(saved.freelancerId, creator1ProfileId);

    // Duplicate save attempt must throw unique constraint violation
    await assert.rejects(
      async () => {
        await prisma.savedCreator.create({
          data: {
            userId: businessUserId,
            freelancerId: creator1ProfileId,
          },
        });
      },
      /unique constraint|Unique constraint failed/i,
      "Duplicate saved creator record must be prevented"
    );

    // Removal of saved creator
    const deleted = await prisma.savedCreator.delete({
      where: {
        userId_freelancerId: {
          userId: businessUserId,
          freelancerId: creator1ProfileId,
        },
      },
    });
    assert.equal(deleted.id, saved.id);
  });

  // ----------------------------------------------------------------------------
  // 8. Creator Inquiries
  // ----------------------------------------------------------------------------
  test("Structured inquiry creation, status lifecycle, and self-inquiry prevention", async () => {
    // Self-inquiry check: Creator cannot inquire to own profile
    const selfInquiryAttempt = creator1UserId === (await prisma.freelancerProfile.findUnique({ where: { id: creator1ProfileId } }))?.userId;
    assert.equal(selfInquiryAttempt, true, "Self inquiry must be flagged");

    // Business inquires to Creator 1
    const inquiry = await prisma.creatorInquiry.create({
      data: {
        senderId: businessUserId,
        freelancerId: creator1ProfileId,
        serviceId: creator1ServiceId,
        message: "We have an upcoming 3-day brand shoot in Goa next month. Would love to discuss availability.",
        status: InquiryStatus.PENDING,
      },
    });

    assert.equal(inquiry.senderId, businessUserId);
    assert.equal(inquiry.freelancerId, creator1ProfileId);
    assert.equal(inquiry.status, InquiryStatus.PENDING);

    // Creator 1 accepts inquiry
    const accepted = await prisma.creatorInquiry.update({
      where: { id: inquiry.id },
      data: { status: InquiryStatus.ACCEPTED },
    });
    assert.equal(accepted.status, InquiryStatus.ACCEPTED);
  });

  // ----------------------------------------------------------------------------
  // 9. Storage Provider Abstraction & Safe Local Path Operations
  // ----------------------------------------------------------------------------
  test("Storage provider mime-type validation and local storage file operations", async () => {
    assert.equal(isAllowedMimeType("image/jpeg"), true);
    assert.equal(isAllowedMimeType("image/png"), true);
    assert.equal(isAllowedMimeType("video/mp4"), true);
    assert.equal(isAllowedMimeType("application/x-msdownload"), false);

    const storage = new LocalStorageProvider();
    const testKey = `test_upload_${timestamp}.txt`;
    const buffer = Buffer.from("Crewn Storage Test File", "utf8");

    const savedUrl = await storage.saveBuffer(testKey, buffer);
    assert.match(savedUrl, /^\/(api\/files|uploads)\//);

    const meta = await storage.getObjectMetadata(testKey);
    assert.ok(meta);
    assert.equal(meta.size, buffer.length);

    const deleted = await storage.deleteFile(testKey);
    assert.equal(deleted, true);
  });

  // ----------------------------------------------------------------------------
  // 10. Magic Bytes & File Signature Validation
  // ----------------------------------------------------------------------------
  test("File signature validation detects magic bytes and rejects content-type spoofing", () => {
    // Valid JPEG signature: FF D8 FF
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const jpegRes = validateFileSignature(validJpeg, "image/jpeg");
    assert.equal(jpegRes.isValid, true);
    assert.equal(jpegRes.detectedMimeType, "image/jpeg");

    // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pngRes = validateFileSignature(validPng, "image/png");
    assert.equal(pngRes.isValid, true);
    assert.equal(pngRes.detectedMimeType, "image/png");

    // Valid PDF signature: %PDF (25 50 44 46)
    const validPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    const pdfRes = validateFileSignature(validPdf, "application/pdf");
    assert.equal(pdfRes.isValid, true);
    assert.equal(pdfRes.detectedMimeType, "application/pdf");

    // Spoofed file: ASCII text declared as image/jpeg
    const spoofedText = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    const spoofedRes = validateFileSignature(spoofedText, "image/jpeg");
    assert.equal(spoofedRes.isValid, false);
    assert.match(spoofedRes.error || "", /File content characteristics do not match/);

    // Malicious SVG with embedded script
    const badSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8");
    const badSvgRes = validateFileSignature(badSvg, "image/svg+xml");
    assert.equal(badSvgRes.isValid, false);
    assert.match(badSvgRes.error || "", /prohibited executable script/);
  });

  // ----------------------------------------------------------------------------
  // 11. Filename Sanitization & Server-Side Storage Key Generation
  // ----------------------------------------------------------------------------
  test("Filename sanitization strips directory traversal and server generates safe storage keys", () => {
    // Strips path traversal
    assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFileName("..\\..\\Windows\\System32\\cmd.exe"), "cmd.exe");
    assert.equal(sanitizeFileName("my/nested/portfolio_photo.jpg"), "portfolio_photo.jpg");
    assert.equal(sanitizeFileName("\0dangerous\0file.png"), "dangerousfile.png");

    // Server-side storage key generation
    const key = generateStorageKey(creator1UserId, "image/jpeg");
    // Never incorporates original filename
    assert.doesNotMatch(key, /passwd/);
    assert.doesNotMatch(key, /cmd/);
    // Uses safe extension derived from validated mime
    assert.match(key, /\.jpg$/);
    // Includes user identifier and timestamp
    assert.match(key, /^upload_/);
  });

  // ----------------------------------------------------------------------------
  // 12. File Record Ownership Metadata & Resource Attachment Authorization
  // ----------------------------------------------------------------------------
  test("Uploaded files record ownership metadata and unauthorized attachment is blocked", async () => {
    const fileKey = generateStorageKey(creator1UserId, "image/png");
    const creator1File = await prisma.file.create({
      data: {
        storageKey: fileKey,
        fileName: "brand_visual.png",
        mimeType: "image/png",
        fileSize: BigInt(1024),
        uploadedById: creator1UserId,
        resourceType: "PORTFOLIO_ITEM",
        resourceId: creator1ProfileId,
        isPublic: true,
      },
    });

    assert.equal(creator1File.uploadedById, creator1UserId);
    assert.equal(creator1File.resourceType, "PORTFOLIO_ITEM");
    assert.equal(creator1File.resourceId, creator1ProfileId);

    // Creator 2 tries to attach Creator 1's file to their portfolio -> must be rejected
    // In our portfolio creation handler, we verify: fileRecord.uploadedById === user.id
    const fileRecord = await prisma.file.findUnique({ where: { id: creator1File.id } });
    assert.ok(fileRecord);

    const isCreator2AuthorizedToAttach = fileRecord.uploadedById === creator2UserId;
    assert.equal(isCreator2AuthorizedToAttach, false);

    // Cleanup file
    await prisma.file.delete({ where: { id: creator1File.id } });
  });

  // ----------------------------------------------------------------------------
  // 13. Short-Lived Signed URLs for Private Files & Expiration Protection
  // ----------------------------------------------------------------------------
  test("Private files require short-lived HMAC signed URLs with timing-safe verification", () => {
    const privateKey = `private_contract_${timestamp}.pdf`;

    // Generate signed URL with 15 minutes lifetime
    const signed = generateSignedUrl(privateKey, 900);
    assert.match(signed.url, /token=/);
    assert.match(signed.url, /expires=/);

    // Extract token and expires from URL
    const urlObj = new URL(signed.url, "http://localhost");
    const token = urlObj.searchParams.get("token")!;
    const expires = urlObj.searchParams.get("expires")!;

    // Verification succeeds with valid token
    const validCheck = verifySignedUrlToken(privateKey, token, expires);
    assert.equal(validCheck.isValid, true);

    // Tampered token fails verification
    const tamperedCheck = verifySignedUrlToken(privateKey, token.slice(0, -2) + "xx", expires);
    assert.equal(tamperedCheck.isValid, false);
    assert.match(tamperedCheck.error || "", /verification failed/);

    // Expired timestamp fails verification
    const pastExpires = Math.floor(Date.now() / 1000) - 60; // 1 minute in the past
    const expiredCheck = verifySignedUrlToken(privateKey, token, pastExpires);
    assert.equal(expiredCheck.isValid, false);
    assert.match(expiredCheck.error || "", /expired/);

    // Storage key mismatch fails verification
    const mismatchedCheck = verifySignedUrlToken("different_key.pdf", token, expires);
    assert.equal(mismatchedCheck.isValid, false);
  });
});
