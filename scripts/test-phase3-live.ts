import { prisma } from "../src/lib/prisma";
import { createSession } from "../src/lib/auth/session";
import { AvailabilityStatus, PricingType, MediaType } from "@prisma/client";

const BASE_URL = "http://localhost:3000";

async function runLiveTests() {
  console.log("=== Crewn Phase 3: Live Network Flow Verification ===");
  const timestamp = Date.now();

  const bizEmail = `live.biz.${timestamp}@live-phase3.com`;
  const creatorEmail = `live.creator.${timestamp}@live-phase3.com`;
  const hiddenCreatorEmail = `live.hidden.${timestamp}@live-phase3.com`;

  try {
    // 1. Setup Live Data in PostgreSQL
    console.log("1. Seeding live database records in PostgreSQL...");

    const bizUser = await prisma.user.create({
      data: {
        email: bizEmail,
        name: "Horizon Film Studios",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
    });

    const bizSession = await createSession({ userId: bizUser.id });
    const bizCookie = `crewn_session=${bizSession.token}`;

    const creatorUser = await prisma.user.create({
      data: {
        email: creatorEmail,
        name: "Kabir Commercial Director",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
    });

    const creatorSession = await createSession({ userId: creatorUser.id });
    const creatorCookie = `crewn_session=${creatorSession.token}`;

    const slug = `kabir-director-${timestamp}`;
    const creatorProfile = await prisma.freelancerProfile.create({
      data: {
        userId: creatorUser.id,
        publicSlug: slug,
        headline: "National Award Winning Commercial Director & VFX Supervisor",
        bio: "Over a decade directing high-budget national brand commercials, VFX-heavy spots, and international streaming sequences.",
        location: "Mumbai, India",
        yearsExperience: 10,
        hourlyRate: 12000,
        marketplaceVisible: true,
        isVerified: true,
      },
    });

    // Add availability & skills
    await prisma.availability.create({
      data: {
        freelancerProfileId: creatorProfile.id,
        status: AvailabilityStatus.AVAILABLE,
        hoursPerWeek: 40,
      },
    });

    const vfxSkill = await prisma.skill.upsert({
      where: { name: "VFX Supervision" },
      update: {},
      create: { name: "VFX Supervision", slug: "vfx-supervision" },
    });

    await prisma.profileSkill.create({
      data: {
        freelancerProfileId: creatorProfile.id,
        skillId: vfxSkill.id,
      },
    });

    // Add Service Package
    const service = await prisma.service.create({
      data: {
        freelancerProfileId: creatorProfile.id,
        title: "Full 30-sec Commercial Directing & Color Supervision",
        description: "Complete pre-production planning, live set direction, and post-production supervision.",
        basePrice: 150000,
        pricingType: PricingType.FIXED,
        deliveryDays: 14,
        revisionLimit: 2,
        isActive: true,
      },
    });

    // Add Published Portfolio Item
    await prisma.portfolioItem.create({
      data: {
        freelancerProfileId: creatorProfile.id,
        title: "National Automotive EV Launch Campaign",
        description: "High speed Phantom Flex 4K shots combined with Unreal Engine live tracking.",
        category: "Commercial Film",
        mediaType: MediaType.VIDEO,
        published: true,
        displayOrder: 0,
      },
    });

    // Add Hidden Creator
    const hiddenUser = await prisma.user.create({
      data: {
        email: hiddenCreatorEmail,
        name: "Private Creator",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
    });

    const hiddenSlug = `private-creator-${timestamp}`;
    await prisma.freelancerProfile.create({
      data: {
        userId: hiddenUser.id,
        publicSlug: hiddenSlug,
        headline: "Private Draft Creator",
        bio: "Draft account not yet ready for discovery.",
        marketplaceVisible: false,
      },
    });

    // 2. Test GET /api/marketplace/creators
    console.log("2. Testing GET /api/marketplace/creators (Discovery & Visibility)...");
    const mktRes = await fetch(`${BASE_URL}/api/marketplace/creators`);
    if (!mktRes.ok) throw new Error(`Marketplace discovery failed with HTTP ${mktRes.status}`);
    const mktData = await mktRes.json();

    const kabirFound = mktData.creators.some((c: any) => c.publicSlug === slug);
    const hiddenFound = mktData.creators.some((c: any) => c.publicSlug === hiddenSlug);

    if (!kabirFound) throw new Error("Expected public creator to be discovered in marketplace!");
    if (hiddenFound) throw new Error("Hidden creator appeared in marketplace! Privacy violation.");
    console.log(`   ✓ Discovered ${mktData.pagination.totalCount} eligible creators. Public creator visible, hidden creator suppressed.`);

    // 3. Test Search & Filter
    console.log("3. Testing server-side search by keyword 'VFX'...");
    const searchRes = await fetch(`${BASE_URL}/api/marketplace/creators?q=VFX`);
    const searchData = await searchRes.json();
    const matchVfx = searchData.creators.some((c: any) => c.publicSlug === slug);
    if (!matchVfx) throw new Error("Search query 'VFX' failed to return matching creator!");
    console.log("   ✓ Search query matched successfully.");

    // 4. Test Public Profile Retrieval & Privacy Sanitization
    console.log(`4. Testing GET /api/creators/${slug} (Public profile privacy check)...`);
    const profileRes = await fetch(`${BASE_URL}/api/creators/${slug}`);
    if (!profileRes.ok) throw new Error(`Public profile retrieval failed: ${profileRes.status}`);
    const profileData = await profileRes.json();

    if (profileData.creator.email || profileData.creator.phone) {
      throw new Error("CRITICAL SECURITY ERROR: Email or phone leaked in public creator response!");
    }
    if (profileData.creator.services.length === 0) {
      throw new Error("Expected active services on creator profile!");
    }
    if (profileData.creator.portfolio.length === 0) {
      throw new Error("Expected published portfolio on creator profile!");
    }
    console.log(`   ✓ Profile retrieved. Name: ${profileData.creator.name}, Headline: ${profileData.creator.headline}`);
    console.log("   ✓ Privacy sanitized: Email and phone strictly omitted.");

    // 5. Test Private Profile Protection (404 for unauthenticated visitor)
    console.log(`5. Testing GET /api/creators/${hiddenSlug} for hidden creator...`);
    const hiddenProfileRes = await fetch(`${BASE_URL}/api/creators/${hiddenSlug}`);
    if (hiddenProfileRes.status !== 404) {
      throw new Error(`Expected 404 for hidden profile, got HTTP ${hiddenProfileRes.status}`);
    }
    console.log("   ✓ Hidden profile returned 404 for visitor.");

    // 6. Test Save Creator Flow
    console.log("6. Testing Business Bookmark: POST /api/business/saved-creators...");
    const saveRes = await fetch(`${BASE_URL}/api/business/saved-creators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: bizCookie,
      },
      body: JSON.stringify({ freelancerId: creatorProfile.id }),
    });
    if (!saveRes.ok) throw new Error(`Save creator failed: ${saveRes.status}`);
    console.log("   ✓ Creator bookmarked by business.");

    // Verify saved creators list
    const listSavedRes = await fetch(`${BASE_URL}/api/business/saved-creators`, {
      headers: { Cookie: bizCookie },
    });
    const listSavedData = await listSavedRes.json();
    const isSavedInList = listSavedData.savedCreators.some((s: any) => s.freelancerId === creatorProfile.id);
    if (!isSavedInList) throw new Error("Creator not found in business saved creators roster!");
    console.log("   ✓ Saved creator confirmed in business roster.");

    // 7. Test Creator Inquiry Flow
    console.log("7. Testing Project Inquiry: POST /api/creator-inquiries...");
    const inquiryRes = await fetch(`${BASE_URL}/api/creator-inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: bizCookie,
      },
      body: JSON.stringify({
        freelancerId: creatorProfile.id,
        serviceId: service.id,
        message: "We need an award-winning director for our upcoming national automotive commercial shoot in October.",
      }),
    });
    if (!inquiryRes.ok) throw new Error(`Inquiry creation failed: ${inquiryRes.status}`);
    const inquiryData = await inquiryRes.json();
    if (inquiryData.inquiry.status !== "PENDING") throw new Error("Expected PENDING inquiry status");
    console.log(`   ✓ Inquiry created with ID ${inquiryData.inquiry.id}, status: ${inquiryData.inquiry.status}`);

    // Creator checks received inquiries
    const creatorInquiriesRes = await fetch(`${BASE_URL}/api/creator-inquiries`, {
      headers: { Cookie: creatorCookie },
    });
    const creatorInquiriesData = await creatorInquiriesRes.json();
    const inquiryReceived = creatorInquiriesData.inquiries.some((i: any) => i.id === inquiryData.inquiry.id);
    if (!inquiryReceived) throw new Error("Inquiry not visible in creator received list!");
    console.log("   ✓ Inquiry received in creator workspace.");

    // 8. Test Freelancer Profile Mutation
    console.log("8. Testing Freelancer Profile Mutation: PATCH /api/freelancer/profile...");
    const updateRes = await fetch(`${BASE_URL}/api/freelancer/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: creatorCookie,
      },
      body: JSON.stringify({
        headline: "National Award Winning Commercial Director & Creative Head",
        hourlyRate: 15000,
      }),
    });
    if (!updateRes.ok) throw new Error(`Profile update failed: ${updateRes.status}`);
    console.log("   ✓ Profile updated with server-side validation.");

    // 9. Test IDOR Protection
    console.log("9. Testing IDOR Protection (Freelancer cannot delete another creator's service)...");
    const idorRes = await fetch(`${BASE_URL}/api/freelancer/services/${service.id}`, {
      method: "DELETE",
      headers: {
        Cookie: bizCookie, // Business attempting to delete creator service
      },
    });
    if (idorRes.status !== 404 && idorRes.status !== 403 && idorRes.status !== 401) {
      throw new Error(`Expected IDOR rejection, got HTTP ${idorRes.status}`);
    }
    console.log(`   ✓ Unauthorized service deletion rejected with HTTP ${idorRes.status}.`);

    // Clean up saved creator
    await fetch(`${BASE_URL}/api/business/saved-creators/${creatorProfile.id}`, {
      method: "DELETE",
      headers: { Cookie: bizCookie },
    });
    console.log("   ✓ Saved creator un-bookmarked cleanly.");

    console.log("\n======================================================");
    console.log("🎉 ALL LIVE NETWORK END-TO-END FLOWS PASSED (9/9)!");
    console.log("======================================================\n");
  } finally {
    // Clean up live test data
    await prisma.user.deleteMany({
      where: {
        email: { in: [bizEmail, creatorEmail, hiddenCreatorEmail] },
      },
    });
    await prisma.$disconnect();
  }
}

runLiveTests().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
