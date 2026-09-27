import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "BUSINESS" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only business accounts can view saved creators" },
        { status: 403 }
      );
    }

    const saved = await prisma.savedCreator.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        freelancer: {
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
            skills: {
              take: 4,
              include: { skill: true },
            },
            services: {
              where: { isActive: true },
              take: 2,
              select: {
                id: true,
                title: true,
                basePrice: true,
              },
            },
          },
        },
      },
    });

    const creators = saved.map((s) => ({
      savedId: s.id,
      savedAt: s.createdAt,
      freelancerId: s.freelancerId,
      publicSlug: s.freelancer.publicSlug,
      name: s.freelancer.user.name || "Anonymous Creator",
      avatarUrl: s.freelancer.user.avatarUrl,
      headline: s.freelancer.headline,
      location: s.freelancer.location,
      hourlyRate: s.freelancer.hourlyRate ? Number(s.freelancer.hourlyRate) : null,
      isVerified: s.freelancer.isVerified || s.freelancer.user.isVerified,
      skills: s.freelancer.skills.map((sk) => sk.skill.name),
    }));

    return NextResponse.json({ savedCreators: creators });
  } catch (error) {
    console.error("Get saved creators error:", error);
    return NextResponse.json({ error: "Failed to get saved creators" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "BUSINESS" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only business accounts can save creators" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { freelancerId } = body;

    if (!freelancerId || typeof freelancerId !== "string") {
      return NextResponse.json({ error: "freelancerId is required" }, { status: 400 });
    }

    // Check freelancer exists
    const freelancer = await prisma.freelancerProfile.findUnique({
      where: { id: freelancerId },
    });

    if (!freelancer) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Upsert to prevent duplicate errors
    const record = await prisma.savedCreator.upsert({
      where: {
        userId_freelancerId: {
          userId: user.id,
          freelancerId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        freelancerId,
      },
    });

    return NextResponse.json({ success: true, saved: record });
  } catch (error) {
    console.error("Save creator error:", error);
    return NextResponse.json({ error: "Failed to save creator" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const freelancerId = searchParams.get("freelancerId");

    if (!freelancerId) {
      return NextResponse.json({ error: "freelancerId parameter required" }, { status: 400 });
    }

    await prisma.savedCreator.deleteMany({
      where: {
        userId: user.id,
        freelancerId,
      },
    });

    return NextResponse.json({ success: true, message: "Creator removed from saved" });
  } catch (error) {
    console.error("Remove saved creator error:", error);
    return NextResponse.json({ error: "Failed to remove saved creator" }, { status: 500 });
  }
}
