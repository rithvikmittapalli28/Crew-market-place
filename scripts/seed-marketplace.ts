import { prisma } from "../src/lib/prisma";
import { AvailabilityStatus, PricingType, MediaType } from "@prisma/client";

async function seedMarketplace() {
  console.log("Seeding real production creator profiles in PostgreSQL...");

  // Creator 1: Aryan Mehta - Commercial Cinematographer
  const user1 = await prisma.user.upsert({
    where: { email: "aryan.mehta@crewn.io" },
    update: { isVerified: true, onboarded: true, isActive: true },
    create: {
      email: "aryan.mehta@crewn.io",
      name: "Aryan Mehta",
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
  });

  const profile1 = await prisma.freelancerProfile.upsert({
    where: { userId: user1.id },
    update: {
      publicSlug: "aryan-mehta",
      headline: "Commercial Director of Photography & Arri / Red Specialist",
      bio: "10+ years lighting and framing automotive commercials, luxury fashion films, and feature documentaries. Extensive experience operating Arri Alexa 35, Red V-Raptor, and Cooke Anamorphic glass.",
      location: "Mumbai, India",
      yearsExperience: 10,
      hourlyRate: 8500,
      marketplaceVisible: true,
      isVerified: true,
      website: "https://aryanmehta.film",
      instagramUrl: "aryanmehtadop",
      behanceUrl: "aryanmehta",
    },
    create: {
      userId: user1.id,
      publicSlug: "aryan-mehta",
      headline: "Commercial Director of Photography & Arri / Red Specialist",
      bio: "10+ years lighting and framing automotive commercials, luxury fashion films, and feature documentaries. Extensive experience operating Arri Alexa 35, Red V-Raptor, and Cooke Anamorphic glass.",
      location: "Mumbai, India",
      yearsExperience: 10,
      hourlyRate: 8500,
      marketplaceVisible: true,
      isVerified: true,
      website: "https://aryanmehta.film",
      instagramUrl: "aryanmehtadop",
      behanceUrl: "aryanmehta",
    },
  });

  await prisma.availability.upsert({
    where: { freelancerProfileId: profile1.id },
    update: { status: AvailabilityStatus.AVAILABLE, hoursPerWeek: 40 },
    create: {
      freelancerProfileId: profile1.id,
      status: AvailabilityStatus.AVAILABLE,
      hoursPerWeek: 40,
    },
  });

  // Services for Aryan
  await prisma.service.createMany({
    data: [
      {
        freelancerProfileId: profile1.id,
        title: "Full Day Commercial Cinematography (Camera & Lens Package)",
        description: "10-hour shoot day as DP including lighting plan, Arri Mini LF package, wireless monitoring, and crew supervision.",
        basePrice: 65000,
        pricingType: PricingType.FIXED,
        deliveryDays: 1,
        revisionLimit: 1,
        category: "Commercial Film",
      },
      {
        freelancerProfileId: profile1.id,
        title: "Technical Pre-Production & Look Development",
        description: "Lens testing, custom LUT creation, lighting breakdowns, and director storyboard collaboration.",
        basePrice: 25000,
        pricingType: PricingType.STARTING_FROM,
        deliveryDays: 3,
        revisionLimit: 2,
        category: "Pre-Production",
      },
    ],
    skipDuplicates: true,
  });

  // Portfolio for Aryan
  await prisma.portfolioItem.createMany({
    data: [
      {
        freelancerProfileId: profile1.id,
        title: "Porsche GT3 RS — Monsoon Track Spec",
        description: "Tracking vehicle Russian Arm shoot captured on Alexa Mini LF with Cooke Anamorphic SF lenses.",
        category: "Automotive",
        mediaType: MediaType.VIDEO,
        externalUrl: "https://vimeo.com/aryanmehta/porsche",
        published: true,
        displayOrder: 0,
      },
      {
        freelancerProfileId: profile1.id,
        title: "Vogue India Couture — Royal Heritage",
        description: "High fashion editorial lighting utilizing natural diffused skylights and Mole-Richardson tungsten fixtures.",
        category: "Editorial",
        mediaType: MediaType.IMAGE,
        externalUrl: "https://behance.net/gallery/vogue-couture",
        published: true,
        displayOrder: 1,
      },
    ],
    skipDuplicates: true,
  });

  // Creator 2: Maya Sen - Senior DaVinci Colorist
  const user2 = await prisma.user.upsert({
    where: { email: "maya.sen@crewn.io" },
    update: { isVerified: true, onboarded: true, isActive: true },
    create: {
      email: "maya.sen@crewn.io",
      name: "Maya Sen",
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
  });

  const profile2 = await prisma.freelancerProfile.upsert({
    where: { userId: user2.id },
    update: {
      publicSlug: "maya-sen",
      headline: "Senior DaVinci Resolve Colorist & Look Architect",
      bio: "Grading commercial campaigns, music videos, and streaming originals on color-calibrated Flanders Scientific OLED displays. ACES color management pipeline specialist.",
      location: "Bengaluru, India",
      yearsExperience: 7,
      hourlyRate: 6000,
      marketplaceVisible: true,
      isVerified: true,
      website: "https://mayacolor.studio",
      instagramUrl: "mayacolorist",
    },
    create: {
      userId: user2.id,
      publicSlug: "maya-sen",
      headline: "Senior DaVinci Resolve Colorist & Look Architect",
      bio: "Grading commercial campaigns, music videos, and streaming originals on color-calibrated Flanders Scientific OLED displays. ACES color management pipeline specialist.",
      location: "Bengaluru, India",
      yearsExperience: 7,
      hourlyRate: 6000,
      marketplaceVisible: true,
      isVerified: true,
      website: "https://mayacolor.studio",
      instagramUrl: "mayacolorist",
    },
  });

  await prisma.availability.upsert({
    where: { freelancerProfileId: profile2.id },
    update: { status: AvailabilityStatus.PARTIALLY_AVAILABLE, hoursPerWeek: 20 },
    create: {
      freelancerProfileId: profile2.id,
      status: AvailabilityStatus.PARTIALLY_AVAILABLE,
      hoursPerWeek: 20,
    },
  });

  await prisma.service.createMany({
    data: [
      {
        freelancerProfileId: profile2.id,
        title: "60-Second Commercial Master Color Grade",
        description: "Conform from XML/EDL, ACES color transform, shot-to-shot matching, skin tone refinement, and DCI-P3 / Rec.709 deliverables.",
        basePrice: 20000,
        pricingType: PricingType.FIXED,
        deliveryDays: 3,
        revisionLimit: 3,
        category: "Color Grading",
      },
    ],
    skipDuplicates: true,
  });

  // Creator 3: Vikram Roy - Commercial Product Photographer
  const user3 = await prisma.user.upsert({
    where: { email: "vikram.roy@crewn.io" },
    update: { isVerified: true, onboarded: true, isActive: true },
    create: {
      email: "vikram.roy@crewn.io",
      name: "Vikram Roy",
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
  });

  const profile3 = await prisma.freelancerProfile.upsert({
    where: { userId: user3.id },
    update: {
      publicSlug: "vikram-roy",
      headline: "Luxury Timepiece & Beverage Product Photographer",
      bio: "Precision macro lighting and high-speed splash photography for luxury Swiss watches, spirits, and premium cosmetics with Phase One medium format systems.",
      location: "New Delhi, India",
      yearsExperience: 6,
      hourlyRate: 5000,
      marketplaceVisible: true,
      isVerified: true,
      website: "https://vikramroy.com",
    },
    create: {
      userId: user3.id,
      publicSlug: "vikram-roy",
      headline: "Luxury Timepiece & Beverage Product Photographer",
      bio: "Precision macro lighting and high-speed splash photography for luxury Swiss watches, spirits, and premium cosmetics with Phase One medium format systems.",
      location: "New Delhi, India",
      yearsExperience: 6,
      hourlyRate: 5000,
      marketplaceVisible: true,
      isVerified: true,
      website: "https://vikramroy.com",
    },
  });

  await prisma.availability.upsert({
    where: { freelancerProfileId: profile3.id },
    update: { status: AvailabilityStatus.AVAILABLE, hoursPerWeek: 35 },
    create: {
      freelancerProfileId: profile3.id,
      status: AvailabilityStatus.AVAILABLE,
      hoursPerWeek: 35,
    },
  });

  await prisma.service.createMany({
    data: [
      {
        freelancerProfileId: profile3.id,
        title: "Half-Day In-Studio Product Commercial Shoot (5 Deliverables)",
        description: "Macro focus stacking, Broncolor lighting setup, high-end composite retouching, and print-ready TIFFs.",
        basePrice: 35000,
        pricingType: PricingType.STARTING_FROM,
        deliveryDays: 5,
        revisionLimit: 2,
        category: "Product Photography",
      },
    ],
    skipDuplicates: true,
  });

  // Skills
  const sFilm = await prisma.skill.upsert({ where: { name: "Cinematography" }, update: {}, create: { name: "Cinematography", slug: "cinematography" } });
  const sColor = await prisma.skill.upsert({ where: { name: "Color Grading" }, update: {}, create: { name: "Color Grading", slug: "color-grading" } });
  const sPhoto = await prisma.skill.upsert({ where: { name: "Commercial Photography" }, update: {}, create: { name: "Commercial Photography", slug: "commercial-photography" } });

  await prisma.profileSkill.createMany({
    data: [
      { freelancerProfileId: profile1.id, skillId: sFilm.id },
      { freelancerProfileId: profile2.id, skillId: sColor.id },
      { freelancerProfileId: profile3.id, skillId: sPhoto.id },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding complete! 3 verified creator profiles are live in PostgreSQL.");
}

seedMarketplace()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
