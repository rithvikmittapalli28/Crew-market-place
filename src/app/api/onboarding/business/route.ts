import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { businessOnboardingSchema } from "@/lib/validations/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to complete onboarding." },
        { status: 401 }
      );
    }

    // Email verification gate enforcement
    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Please verify your email address before completing onboarding." },
        { status: 403 }
      );
    }

    if (user.role !== "BUSINESS") {
      return NextResponse.json(
        { error: "Only accounts registered as BUSINESS can perform business onboarding." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = businessOnboardingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      legalName,
      taxId,
      website,
      logoUrl,
      description,
      industry,
      companySize,
    } = parseResult.data;

    // Generate unique slug
    let baseSlug = slugify(name);
    if (!baseSlug) baseSlug = "business";
    let finalSlug = baseSlug;
    let counter = 1;

    while (await prisma.business.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    // Atomic transaction: Create Business + BusinessMember(OWNER) + update User onboarded
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name,
          slug: finalSlug,
          legalName: legalName || null,
          taxId: taxId || null,
          website: website || null,
          logoUrl: logoUrl || null,
          description: description || null,
          industry,
          companySize,
          isVerified: false,
        },
      });

      const member = await tx.businessMember.create({
        data: {
          businessId: business.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { onboarded: true },
      });

      return { business, member, updatedUser };
    });

    return NextResponse.json({
      success: true,
      message: "Business onboarding completed successfully.",
      business: result.business,
    });
  } catch (error) {
    console.error("Business onboarding error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during business onboarding." },
      { status: 500 }
    );
  }
}
