import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Business user
  const bizUser = await prisma.user.upsert({
    where: { email: "biz.e2e@crewn.com" },
    update: {
      name: "Acme Business Owner",
      passwordHash,
      role: "BUSINESS",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
    create: {
      email: "biz.e2e@crewn.com",
      name: "Acme Business Owner",
      passwordHash,
      role: "BUSINESS",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
  });

  // Business entity
  const business = await prisma.business.upsert({
    where: { slug: "acme-studios-e2e" },
    update: {
      name: "Acme Studios E2E",
      legalName: "Acme Studios India Pvt Ltd",
      taxId: "29AAAAA0000A1Z5",
      isVerified: true,
    },
    create: {
      name: "Acme Studios E2E",
      slug: "acme-studios-e2e",
      legalName: "Acme Studios India Pvt Ltd",
      taxId: "29AAAAA0000A1Z5",
      isVerified: true,
    },
  });

  // Business membership
  await prisma.businessMember.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: bizUser.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      businessId: business.id,
      userId: bizUser.id,
      role: "OWNER",
    },
  });

  // 2. Freelancer user
  const freeUser = await prisma.user.upsert({
    where: { email: "freelancer.e2e@crewn.com" },
    update: {
      name: "Elena Freelancer",
      passwordHash,
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
    create: {
      email: "freelancer.e2e@crewn.com",
      name: "Elena Freelancer",
      passwordHash,
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
  });

  // Freelancer profile
  await prisma.freelancerProfile.upsert({
    where: { userId: freeUser.id },
    update: {
      headline: "Senior 3D Artist & Motion Designer",
      bio: "Experienced 3D visual artist and motion designer with 8+ years building enterprise visuals.",
      isVerified: true,
      hourlyRate: 2500,
    },
    create: {
      userId: freeUser.id,
      headline: "Senior 3D Artist & Motion Designer",
      bio: "Experienced 3D visual artist and motion designer with 8+ years building enterprise visuals.",
      isVerified: true,
      hourlyRate: 2500,
    },
  });

  // 3. Outsider user
  const outsiderUser = await prisma.user.upsert({
    where: { email: "outsider.e2e@crewn.com" },
    update: {
      name: "Unauthorized Outsider",
      passwordHash,
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
    create: {
      email: "outsider.e2e@crewn.com",
      name: "Unauthorized Outsider",
      passwordHash,
      role: "FREELANCER",
      isVerified: true,
      onboarded: true,
      isActive: true,
    },
  });

  console.log("E2E Users successfully seeded:");
  console.log(`- Business: ${bizUser.email} (ID: ${bizUser.id}, Business: ${business.id})`);
  console.log(`- Freelancer: ${freeUser.email} (ID: ${freeUser.id})`);
  console.log(`- Outsider: ${outsiderUser.email} (ID: ${outsiderUser.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
