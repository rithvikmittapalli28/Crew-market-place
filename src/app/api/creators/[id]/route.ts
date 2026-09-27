import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Identifier required" }, { status: 400 });
    }

    const currentUser = await getCurrentUser();

    // Query creator by publicSlug or id
    const profile = await prisma.freelancerProfile.findFirst({
      where: {
        OR: [{ publicSlug: id.toLowerCase() }, { id: id }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
            isActive: true,
          },
        },
        availability: true,
        skills: {
          include: {
            skill: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        services: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        portfolioItems: {
          where: { published: true },
          orderBy: { displayOrder: "asc" },
          include: {
            coverFile: {
              select: {
                id: true,
                storageKey: true,
                fileName: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Check visibility permissions:
    // If not public, only the profile owner can preview
    const isOwner = currentUser?.id === profile.userId;
    if (!profile.marketplaceVisible || !profile.user.isActive) {
      if (!isOwner) {
        return NextResponse.json({ error: "Creator profile is private" }, { status: 404 });
      }
    }

    // Check if current user has saved this creator
    let isSaved = false;
    if (currentUser) {
      const saved = await prisma.savedCreator.findUnique({
        where: {
          userId_freelancerId: {
            userId: currentUser.id,
            freelancerId: profile.id,
          },
        },
      });
      isSaved = !!saved;
    }

    // Get completed projects count
    const completedProjectCount = await prisma.projectMember.count({
      where: {
        userId: profile.userId,
        project: { status: "COMPLETED" },
      },
    });

    // Clean sanitized response without any email, phone, or private data
    const sanitizedProfile = {
      id: profile.id,
      publicSlug: profile.publicSlug,
      name: profile.user.name || "Anonymous Creator",
      avatarUrl: profile.user.avatarUrl,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      yearsExperience: profile.yearsExperience,
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      isVerified: profile.isVerified || profile.user.isVerified,
      marketplaceVisible: profile.marketplaceVisible,
      rating: Number(profile.rating),
      reviewCount: profile.reviewCount,
      website: profile.website,
      instagramUrl: profile.instagramUrl,
      behanceUrl: profile.behanceUrl,
      vimeoUrl: profile.vimeoUrl,
      skills: profile.skills.map((s) => ({
        id: s.skill.id,
        name: s.skill.name,
        slug: s.skill.slug,
      })),
      categories: profile.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        slug: c.category.slug,
      })),
      services: profile.services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category,
        basePrice: Number(s.basePrice),
        pricingType: s.pricingType,
        currency: s.currency,
        deliveryDays: s.deliveryDays,
        revisionLimit: s.revisionLimit,
        imageUrl: s.imageUrl,
      })),
      portfolio: profile.portfolioItems.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        mediaType: p.mediaType,
        externalUrl: p.externalUrl,
        coverFileId: p.coverFileId,
        coverFile: p.coverFile,
        isFeatured: p.isFeatured,
        displayOrder: p.displayOrder,
      })),
      availability: profile.availability
        ? {
            status: profile.availability.status,
            hoursPerWeek: profile.availability.hoursPerWeek,
            nextAvailableDate: profile.availability.nextAvailableDate,
          }
        : null,
      completedProjectCount,
      isSaved,
      isOwner,
    };

    return NextResponse.json({ creator: sanitizedProfile });
  } catch (error) {
    console.error("Public creator fetch error:", error);
    return NextResponse.json({ error: "Failed to load creator profile" }, { status: 500 });
  }
}
