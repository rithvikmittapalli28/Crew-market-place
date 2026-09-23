import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { freelancerOnboardingSchema } from "@/lib/validations/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to complete onboarding." },
        { status: 401 }
      );
    }

    // Email verification gate enforcement
    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Please verify your email address before completing onboarding." },
        { status: 403 }
      );
    }

    if (user.role !== "FREELANCER") {
      return NextResponse.json(
        { error: "Only accounts registered as FREELANCER can perform creator onboarding." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = freelancerOnboardingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      headline,
      bio,
      location,
      hourlyRate,
      yearsExperience,
      website,
      instagramUrl,
      behanceUrl,
      vimeoUrl,
      availabilityStatus,
      hoursPerWeek,
      skills,
      services,
      portfolioItems,
    } = parseResult.data;

    // Check if profile already exists
    const existing = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A freelancer profile already exists for this account." },
        { status: 409 }
      );
    }

    // Atomic transaction: Create Profile + Availability + Skills + Services + Portfolio + update User
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Profile
      const profile = await tx.freelancerProfile.create({
        data: {
          userId: user.id,
          headline,
          bio,
          location: location || null,
          hourlyRate: hourlyRate !== undefined ? hourlyRate : null,
          yearsExperience,
          website: website || null,
          instagramUrl: instagramUrl || null,
          behanceUrl: behanceUrl || null,
          vimeoUrl: vimeoUrl || null,
          isVerified: false,
        },
      });

      // 2. Create Availability
      await tx.availability.create({
        data: {
          freelancerProfileId: profile.id,
          status: availabilityStatus,
          hoursPerWeek: hoursPerWeek || 40,
        },
      });

      // 3. Connect/Create Skills
      for (const skillName of skills) {
        const cleanName = skillName.trim();
        const skillSlug = slugify(cleanName) || "skill";
        const skill = await tx.skill.upsert({
          where: { slug: skillSlug },
          update: { name: cleanName },
          create: { name: cleanName, slug: skillSlug },
        });

        await tx.profileSkill.create({
          data: {
            freelancerProfileId: profile.id,
            skillId: skill.id,
          },
        });
      }

      // 4. Create Services
      if (services && services.length > 0) {
        for (const s of services) {
          await tx.service.create({
            data: {
              freelancerProfileId: profile.id,
              title: s.title,
              description: s.description,
              basePrice: s.basePrice,
              deliveryDays: s.deliveryDays,
              revisionLimit: s.revisionLimit,
              isActive: true,
            },
          });
        }
      }

      // 5. Create Portfolio Items
      if (portfolioItems && portfolioItems.length > 0) {
        for (const p of portfolioItems) {
          await tx.portfolioItem.create({
            data: {
              freelancerProfileId: profile.id,
              title: p.title,
              description: p.description || null,
              mediaType: p.mediaType,
              externalUrl: p.externalUrl || null,
            },
          });
        }
      }

      // 6. Update user onboarded flag
      await tx.user.update({
        where: { id: user.id },
        data: { onboarded: true },
      });

      return profile;
    });

    return NextResponse.json({
      success: true,
      message: "Creator profile created and onboarding completed successfully.",
      profile: result,
    });
  } catch (error) {
    console.error("Freelancer onboarding error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during creator onboarding." },
      { status: 500 }
    );
  }
}
