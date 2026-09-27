import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AvailabilityStatus } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Freelancer profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, hoursPerWeek, nextAvailableDate } = body;

    if (status && !Object.values(AvailabilityStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid availability status" }, { status: 400 });
    }

    const parsedHours =
      hoursPerWeek !== undefined ? Math.max(0, Math.min(168, Number(hoursPerWeek))) : 40;
    const parsedDate = nextAvailableDate ? new Date(nextAvailableDate) : null;

    const availability = await prisma.availability.upsert({
      where: { freelancerProfileId: profile.id },
      update: {
        ...(status ? { status } : {}),
        hoursPerWeek: parsedHours,
        nextAvailableDate: parsedDate,
      },
      create: {
        freelancerProfileId: profile.id,
        status: status || AvailabilityStatus.AVAILABLE,
        hoursPerWeek: parsedHours,
        nextAvailableDate: parsedDate,
      },
    });

    return NextResponse.json({ success: true, availability });
  } catch (error) {
    console.error("Availability update error:", error);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
