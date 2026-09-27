import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MediaType } from "@prisma/client";

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

    const portfolio = await prisma.portfolioItem.findMany({
      where: { freelancerProfileId: profile.id },
      orderBy: { displayOrder: "asc" },
      include: {
        coverFile: {
          select: {
            id: true,
            storageKey: true,
            fileName: true,
            mimeType: true,
          },
        },
      },
    });

    return NextResponse.json({ portfolio });
  } catch (error) {
    console.error("List portfolio error:", error);
    return NextResponse.json({ error: "Failed to list portfolio" }, { status: 500 });
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
      category,
      mediaType,
      externalUrl,
      coverFileId,
      published,
      displayOrder,
      isFeatured,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Portfolio title is required" }, { status: 400 });
    }

    // Verify coverFileId ownership if provided
    if (coverFileId) {
      const fileRecord = await prisma.file.findUnique({
        where: { id: coverFileId },
      });
      if (!fileRecord || fileRecord.uploadedById !== user.id) {
        return NextResponse.json(
          { error: "Invalid cover file or unauthorized file attachment: you can only attach files you own" },
          { status: 403 }
        );
      }
    }

    const validMediaTypes = Object.values(MediaType);
    const parsedMediaType =
      mediaType && validMediaTypes.includes(mediaType)
        ? mediaType
        : MediaType.IMAGE;

    // Get next displayOrder if not specified
    let order = Number(displayOrder);
    if (isNaN(order)) {
      const count = await prisma.portfolioItem.count({
        where: { freelancerProfileId: profile.id },
      });
      order = count;
    }

    const item = await prisma.portfolioItem.create({
      data: {
        freelancerProfileId: profile.id,
        title: title.trim().slice(0, 200),
        description: description ? String(description).trim() : null,
        category: category ? String(category).trim() : null,
        mediaType: parsedMediaType,
        externalUrl: externalUrl ? String(externalUrl).trim() : null,
        coverFileId: coverFileId || null,
        published: published !== undefined ? Boolean(published) : true,
        displayOrder: order,
        isFeatured: Boolean(isFeatured),
      },
      include: {
        coverFile: true,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Create portfolio item error:", error);
    return NextResponse.json({ error: "Failed to create portfolio item" }, { status: 500 });
  }
}
