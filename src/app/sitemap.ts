import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crewn.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${appUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${appUrl}/marketplace`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${appUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${appUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  try {
    const creators = await prisma.freelancerProfile.findMany({
      where: { marketplaceVisible: true },
      select: {
        publicSlug: true,
        id: true,
        updatedAt: true,
      },
      take: 500,
    });

    const creatorRoutes: MetadataRoute.Sitemap = creators.map((creator) => ({
      url: `${appUrl}/creators/${creator.publicSlug || creator.id}`,
      lastModified: creator.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticRoutes, ...creatorRoutes];
  } catch (error) {
    console.error("Failed to generate creator sitemap routes:", error);
    return staticRoutes;
  }
}
