import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { isValidSlug, normalizeSlug } from "@/lib/creators/slug";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            avatarUrl: true,
            phone: true,
            isVerified: true,
          },
        },
        availability: true,
        skills: {
          include: { skill: true },
        },
        categories: {
          include: { category: true },
        },
        services: true,
        portfolioItems: {
          orderBy: { displayOrder: "asc" },
          include: { coverFile: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Fetch freelancer profile error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "FREELANCER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only freelancers can update this profile" }, { status: 403 });
    }

    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      avatarUrl,
      headline,
      bio,
      location,
      yearsExperience,
      hourlyRate,
      publicSlug,
      marketplaceVisible,
      skills,
      website,
      instagramUrl,
      behanceUrl,
      vimeoUrl,
    } = body;

    // Validate publicSlug if provided
    let normalizedSlug: string | undefined = undefined;
    if (publicSlug !== undefined && publicSlug !== null && publicSlug !== "") {
      normalizedSlug = normalizeSlug(publicSlug);
      const validation = isValidSlug(normalizedSlug);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Check collision with other freelancer profiles
      const existingSlug = await prisma.freelancerProfile.findFirst({
        where: {
          publicSlug: normalizedSlug,
          id: { not: profile.id },
        },
      });

      if (existingSlug) {
        return NextResponse.json(
          { error: "This username is already taken. Please choose another." },
          { status: 409 }
        );
      }
    }

    // Server-side validation of numeric inputs
    const parsedYears = yearsExperience !== undefined ? Math.max(0, Number(yearsExperience)) : undefined;
    const parsedRate = hourlyRate !== undefined && hourlyRate !== null ? Math.max(0, Number(hourlyRate)) : undefined;

    // Update User display name or avatar if provided
    if (name !== undefined || avatarUrl !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl ? String(avatarUrl) : null } : {}),
        },
      });
    }

    // Update FreelancerProfile
    const updatedProfile = await prisma.freelancerProfile.update({
      where: { id: profile.id },
      data: {
        ...(headline !== undefined ? { headline: String(headline).trim() } : {}),
        ...(bio !== undefined ? { bio: String(bio).trim() } : {}),
        ...(location !== undefined ? { location: location ? String(location).trim() : null } : {}),
        ...(parsedYears !== undefined ? { yearsExperience: parsedYears } : {}),
        ...(parsedRate !== undefined ? { hourlyRate: parsedRate } : {}),
        ...(normalizedSlug !== undefined ? { publicSlug: normalizedSlug } : {}),
        ...(marketplaceVisible !== undefined ? { marketplaceVisible: Boolean(marketplaceVisible) } : {}),
        ...(website !== undefined ? { website: website ? String(website).trim() : null } : {}),
        ...(instagramUrl !== undefined ? { instagramUrl: instagramUrl ? String(instagramUrl).trim() : null } : {}),
        ...(behanceUrl !== undefined ? { behanceUrl: behanceUrl ? String(behanceUrl).trim() : null } : {}),
        ...(vimeoUrl !== undefined ? { vimeoUrl: vimeoUrl ? String(vimeoUrl).trim() : null } : {}),
      },
    });

    // Handle skills update if provided
    if (Array.isArray(skills)) {
      // Remove existing relations
      await prisma.profileSkill.deleteMany({
        where: { freelancerProfileId: profile.id },
      });

      // Upsert skills and connect
      for (const skillName of skills) {
        const trimmed = String(skillName).trim();
        if (!trimmed) continue;
        const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        const skillRecord = await prisma.skill.upsert({
          where: { name: trimmed },
          update: {},
          create: {
            name: trimmed,
            slug,
          },
        });

        await prisma.profileSkill.create({
          data: {
            freelancerProfileId: profile.id,
            skillId: skillRecord.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Freelancer profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
