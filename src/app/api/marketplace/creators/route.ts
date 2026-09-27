import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AvailabilityStatus, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q")?.trim();
    const category = searchParams.get("category")?.trim();
    const skill = searchParams.get("skill")?.trim();
    const availability = searchParams.get("availability") as AvailabilityStatus | null;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const minExperience = searchParams.get("minExperience") ? Number(searchParams.get("minExperience")) : undefined;
    const location = searchParams.get("location")?.trim();
    const sort = searchParams.get("sort") || "newest";
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 12), 1), 50);

    // Build base discovery conditions
    const where: Prisma.FreelancerProfileWhereInput = {
      marketplaceVisible: true,
      headline: { not: "" },
      user: {
        isVerified: true,
        isActive: true,
      },
    };

    // Text search filter
    if (query) {
      where.OR = [
        { headline: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
        { user: { name: { contains: query, mode: "insensitive" } } },
        {
          skills: {
            some: {
              skill: {
                name: { contains: query, mode: "insensitive" },
              },
            },
          },
        },
        {
          services: {
            some: {
              isActive: true,
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    // Category filter
    if (category) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            {
              categories: {
                some: {
                  category: {
                    slug: { equals: category.toLowerCase() },
                  },
                },
              },
            },
            {
              services: {
                some: {
                  isActive: true,
                  category: { equals: category, mode: "insensitive" },
                },
              },
            },
          ],
        },
      ];
    }

    // Skill filter
    if (skill) {
      where.skills = {
        some: {
          skill: {
            name: { equals: skill, mode: "insensitive" },
          },
        },
      };
    }

    // Availability filter
    if (availability && Object.values(AvailabilityStatus).includes(availability)) {
      where.availability = {
        status: availability,
      };
    }

    // Experience filter
    if (minExperience !== undefined && !isNaN(minExperience)) {
      where.yearsExperience = {
        gte: minExperience,
      };
    }

    // Location filter
    if (location) {
      where.location = {
        contains: location,
        mode: "insensitive",
      };
    }

    // Price filter (hourlyRate)
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Prisma.DecimalNullableFilter = {};
      if (minPrice !== undefined && !isNaN(minPrice)) priceFilter.gte = minPrice;
      if (maxPrice !== undefined && !isNaN(maxPrice)) priceFilter.lte = maxPrice;
      where.hourlyRate = priceFilter;
    }

    // Sorting
    let orderBy: Prisma.FreelancerProfileOrderByWithRelationInput[];
    switch (sort) {
      case "price_asc":
        orderBy = [{ hourlyRate: "asc" }, { id: "desc" }];
        break;
      case "price_desc":
        orderBy = [{ hourlyRate: "desc" }, { id: "desc" }];
        break;
      case "experience":
        orderBy = [{ yearsExperience: "desc" }, { id: "desc" }];
        break;
      case "recent":
        orderBy = [{ updatedAt: "desc" }, { id: "desc" }];
        break;
      case "newest":
      default:
        orderBy = [{ createdAt: "desc" }, { id: "desc" }];
        break;
    }

    // Query total count and items
    const [totalCount, profiles] = await Promise.all([
      prisma.freelancerProfile.count({ where }),
      prisma.freelancerProfile.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy,
        select: {
          id: true,
          publicSlug: true,
          headline: true,
          location: true,
          yearsExperience: true,
          hourlyRate: true,
          isVerified: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              avatarUrl: true,
              isVerified: true,
            },
          },
          availability: {
            select: {
              status: true,
              hoursPerWeek: true,
              nextAvailableDate: true,
            },
          },
          skills: {
            take: 5,
            select: {
              skill: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          services: {
            where: { isActive: true },
            take: 3,
            select: {
              id: true,
              title: true,
              basePrice: true,
              pricingType: true,
              currency: true,
            },
          },
        },
      }),
    ]);

    const hasMore = profiles.length > limit;
    const items = hasMore ? profiles.slice(0, limit) : profiles;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Transform to clean, sanitized response cards
    const creators = items.map((p) => {
      // Find starting price
      const servicePrices = p.services.map((s) => Number(s.basePrice));
      const startingPrice =
        servicePrices.length > 0
          ? Math.min(...servicePrices)
          : p.hourlyRate
          ? Number(p.hourlyRate)
          : null;

      return {
        id: p.id,
        publicSlug: p.publicSlug || p.id,
        name: p.user.name || "Anonymous Creator",
        avatarUrl: p.user.avatarUrl,
        headline: p.headline,
        location: p.location,
        yearsExperience: p.yearsExperience,
        hourlyRate: p.hourlyRate ? Number(p.hourlyRate) : null,
        startingPrice,
        isVerified: p.isVerified || p.user.isVerified,
        availability: p.availability
          ? {
              status: p.availability.status,
              hoursPerWeek: p.availability.hoursPerWeek,
              nextAvailableDate: p.availability.nextAvailableDate,
            }
          : null,
        topSkills: p.skills.map((s) => s.skill.name),
        servicesCount: p.services.length,
      };
    });

    return NextResponse.json({
      creators,
      pagination: {
        totalCount,
        nextCursor,
        hasMore,
        limit,
      },
    });
  } catch (error) {
    console.error("Marketplace creators error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve creators" },
      { status: 500 }
    );
  }
}
