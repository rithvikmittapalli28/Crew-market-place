import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PricingType } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // IDOR Protection: ensure service belongs to authenticated freelancer
    if (existingService.freelancerProfileId !== profile.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this service" },
        { status: 403 }
      );
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

    const priceNum =
      basePrice !== undefined ? Math.max(0, Number(basePrice)) : undefined;

    const validPricingTypes = Object.values(PricingType);
    const parsedPricingType =
      pricingType && validPricingTypes.includes(pricingType)
        ? pricingType
        : undefined;

    const updated = await prisma.service.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim().slice(0, 200) } : {}),
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(priceNum !== undefined ? { basePrice: priceNum } : {}),
        ...(parsedPricingType ? { pricingType: parsedPricingType } : {}),
        ...(currency !== undefined ? { currency: String(currency) } : {}),
        ...(deliveryDays !== undefined ? { deliveryDays: Math.max(1, Number(deliveryDays)) } : {}),
        ...(revisionLimit !== undefined ? { revisionLimit: Math.max(0, Number(revisionLimit)) } : {}),
        ...(category !== undefined ? { category: category ? String(category).trim() : null } : {}),
        ...(imageUrl !== undefined ? { imageUrl: imageUrl ? String(imageUrl).trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      service: {
        ...updated,
        basePrice: Number(updated.basePrice),
      },
    });
  } catch (error) {
    console.error("Service update error:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // IDOR Protection: ensure service belongs to authenticated freelancer
    if (existingService.freelancerProfileId !== profile.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this service" },
        { status: 403 }
      );
    }

    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    console.error("Service deletion error:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
