import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  legalName: z.string().max(160).optional().or(z.literal("")),
  taxId: z.string().max(50).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  industry: z.string().min(2).max(100).optional(),
  companySize: z.string().min(1).optional(),
});

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || session.role !== "BUSINESS") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the business where user is OWNER
    const membership = await prisma.businessMember.findFirst({
      where: {
        userId: session.userId,
        role: "OWNER",
      },
      include: { business: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "No owned business found for this account." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = updateBusinessSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const updated = await prisma.business.update({
      where: { id: membership.businessId },
      data: {
        name: data.name,
        legalName: data.legalName || null,
        taxId: data.taxId || null,
        website: data.website || null,
        logoUrl: data.logoUrl || null,
        description: data.description || null,
        industry: data.industry,
        companySize: data.companySize,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Business organization updated successfully.",
      business: updated,
    });
  } catch (error) {
    console.error("Business update error:", error);
    return NextResponse.json({ error: "Failed to update business." }, { status: 500 });
  }
}
