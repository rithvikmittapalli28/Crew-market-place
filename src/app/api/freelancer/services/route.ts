import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PricingType } from "@prisma/client";

export async function GET() {
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

    const services = await prisma.service.findMany({
      where: { freelancerProfileId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      services: services.map((s) => ({
        ...s,
        basePrice: Number(s.basePrice),
      })),
    });
  } catch (error) {
    console.error("List services error:", error);
    return NextResponse.json({ error: "Failed to list services" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const {
      title,
      description,
      basePrice,
      pricingType,
      currency,
      deliveryDays,
      revisionLimit,
      category,
      imageUrl,
      isActive,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Service title is required" }, { status: 400 });
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Service description is required" }, { status: 400 });
    }

    const priceNum = Number(basePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 });
    }

    const validPricingTypes = Object.values(PricingType);
    const parsedPricingType = validPricingTypes.includes(pricingType)
      ? pricingType
      : PricingType.FIXED;

    const daysNum = Math.max(1, Number(deliveryDays) || 1);
    const revNum = Math.max(0, Number(revisionLimit) || 0);

    const service = await prisma.service.create({
      data: {
        freelancerProfileId: profile.id,
        title: title.trim().slice(0, 200),
        description: description.trim(),
        basePrice: priceNum,
        pricingType: parsedPricingType,
        currency: currency || "INR",
        deliveryDays: daysNum,
        revisionLimit: revNum,
        category: category ? String(category).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json({
      success: true,
      service: {
        ...service,
        basePrice: Number(service.basePrice),
      },
    });
  } catch (error) {
    console.error("Create service error:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
