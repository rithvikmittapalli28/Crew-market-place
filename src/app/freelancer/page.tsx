import { requireFreelancer } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CreatorStudioManager } from "@/components/freelancer/creator-studio-manager";
import Link from "next/link";

export default async function FreelancerDashboardPage() {
  const authUser = await requireFreelancer();

  const profile = await prisma.freelancerProfile.findUnique({
    where: { id: authUser.freelancerProfileId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          avatarUrl: true,
          isVerified: true,
        },
      },
      availability: true,
      services: {
        orderBy: { createdAt: "desc" },
      },
      skills: {
        include: { skill: true },
      },
      portfolioItems: {
        orderBy: { displayOrder: "asc" },
        include: {
          coverFile: {
            select: {
              storageKey: true,
              fileName: true,
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <EmptyState
          title="Profile not found"
          description="Your creator studio profile could not be loaded."
          action={
            <Link href="/">
              <Button variant="default" size="sm">
                Return Home
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const initialProfile = {
    id: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    avatarUrl: profile.user.avatarUrl,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    yearsExperience: profile.yearsExperience,
    hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
    publicSlug: profile.publicSlug,
    marketplaceVisible: profile.marketplaceVisible,
    isVerified: profile.isVerified || profile.user.isVerified,
    website: profile.website,
    instagramUrl: profile.instagramUrl,
    behanceUrl: profile.behanceUrl,
    vimeoUrl: profile.vimeoUrl,
    availability: profile.availability
      ? {
          status: profile.availability.status,
          hoursPerWeek: profile.availability.hoursPerWeek,
          nextAvailableDate: profile.availability.nextAvailableDate
            ? profile.availability.nextAvailableDate.toISOString()
            : null,
        }
      : null,
    skills: profile.skills.map((s) => ({
      id: s.skill.id,
      name: s.skill.name,
    })),
    services: profile.services.map((srv) => ({
      id: srv.id,
      title: srv.title,
      description: srv.description,
      category: srv.category,
      basePrice: Number(srv.basePrice),
      pricingType: srv.pricingType,
      currency: srv.currency,
      deliveryDays: srv.deliveryDays,
      revisionLimit: srv.revisionLimit,
      isActive: srv.isActive,
    })),
    portfolioItems: profile.portfolioItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      mediaType: item.mediaType,
      externalUrl: item.externalUrl,
      coverFileId: item.coverFileId,
      coverFile: item.coverFile,
      published: item.published,
      displayOrder: item.displayOrder,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={`${profile.user.name || "Creator Studio"} — Workspace`}
        subtitle="Manage your editorial portfolio, service packages, availability, and marketplace visibility"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CreatorStudioManager initialProfile={initialProfile} />
      </main>
    </div>
  );
}
