import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { CreatorProfileView } from "@/components/creators/creator-profile-view";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: "Creator Not Found | Crewn" };

  const profile = await prisma.freelancerProfile.findFirst({
    where: {
      OR: [{ publicSlug: slug.toLowerCase() }, { id: slug }],
    },
    include: {
      user: {
        select: {
          name: true,
          avatarUrl: true,
          isVerified: true,
        },
      },
    },
  });

  if (!profile || !profile.marketplaceVisible) {
    return {
      title: "Creator Profile | Crewn",
      robots: { index: false, follow: false },
    };
  }

  const creatorName = profile.user.name || "Creative Professional";
  const headline = profile.headline || "Commercial Creator";
  const description = profile.bio ? profile.bio.slice(0, 155) : `Hire ${creatorName} for your next creative project on Crewn.`;

  return {
    title: `${creatorName} — ${headline} | Crewn`,
    description,
    openGraph: {
      title: `${creatorName} | Crewn Creator Directory`,
      description,
      type: "profile",
      images: profile.user.avatarUrl ? [{ url: profile.user.avatarUrl }] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CreatorProfilePage({ params }: PageProps) {
  const { slug } = await params;
  if (!slug) notFound();

  const currentUser = await getCurrentUser();

  const profile = await prisma.freelancerProfile.findFirst({
    where: {
      OR: [{ publicSlug: slug.toLowerCase() }, { id: slug }],
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
        include: { skill: true },
      },
      categories: {
        include: { category: true },
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

  if (!profile || !profile.user.isActive) {
    notFound();
  }

  const isOwner = currentUser?.id === profile.userId;

  // Visibility check: private profiles are only visible to the owner in preview mode
  if (!profile.marketplaceVisible && !isOwner) {
    notFound();
  }

  // Saved check for business user
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
    isSaved = Boolean(saved);
  }

  // Completed projects count
  const completedProjectCount = await prisma.projectMember.count({
    where: {
      userId: profile.userId,
      project: { status: "COMPLETED" },
    },
  });

  // Strict privacy sanitization: no email, no phone, no internal session details
  const sanitizedCreator = {
    id: profile.id,
    userId: profile.userId,
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
          nextAvailableDate: profile.availability.nextAvailableDate
            ? profile.availability.nextAvailableDate.toISOString()
            : null,
        }
      : null,
    completedProjectCount,
    isSaved,
    isOwner,
  };

  return (
    <CreatorProfileView
      creator={sanitizedCreator}
      currentUserId={currentUser?.id}
      currentUserRole={currentUser?.role}
    />
  );
}
