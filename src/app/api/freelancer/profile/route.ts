import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const updateFreelancerSchema = z.object({
  headline: z.string().min(3).max(120).optional(),
  bio: z.string().min(20).max(2000).optional(),
  location: z.string().max(100).optional().or(z.literal("")),
  hourlyRate: z.number().positive().optional(),
  yearsExperience: z.number().int().min(0).optional(),
  website: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
  behanceUrl: z.string().url().optional().or(z.literal("")),
  vimeoUrl: z.string().url().optional().or(z.literal("")),
  availabilityStatus: z.enum(["AVAILABLE", "PARTIALLY_AVAILABLE", "BUSY", "UNAVAILABLE"]).optional(),
  hoursPerWeek: z.number().int().min(1).max(168).optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || session.role !== "FREELANCER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: session.userId },
      include: { availability: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Freelancer profile not found." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = updateFreelancerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProfile = await tx.freelancerProfile.update({
        where: { id: profile.id },
        data: {
          headline: data.headline,
          bio: data.bio,
          location: data.location || null,
          hourlyRate: data.hourlyRate !== undefined ? data.hourlyRate : undefined,
          yearsExperience: data.yearsExperience,
          website: data.website || null,
          instagramUrl: data.instagramUrl || null,
          behanceUrl: data.behanceUrl || null,
          vimeoUrl: data.vimeoUrl || null,
        },
      });

      if (data.availabilityStatus || data.hoursPerWeek !== undefined) {
        await tx.availability.upsert({
          where: { freelancerProfileId: profile.id },
          create: {
            freelancerProfileId: profile.id,
            status: data.availabilityStatus || "AVAILABLE",
            hoursPerWeek: data.hoursPerWeek || 40,
          },
          update: {
            status: data.availabilityStatus,
            hoursPerWeek: data.hoursPerWeek,
          },
        });
      }

      return updatedProfile;
    });

    return NextResponse.json({
      success: true,
      message: "Creator profile updated successfully.",
      profile: updated,
    });
  } catch (error) {
    console.error("Freelancer profile update error:", error);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
