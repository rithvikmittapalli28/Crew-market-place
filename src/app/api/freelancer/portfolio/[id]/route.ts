import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { MediaType } from "@prisma/client";

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

    const existing = await prisma.portfolioItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Portfolio item not found" }, { status: 404 });
    }

    // IDOR Protection
    if (existing.freelancerProfileId !== profile.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this portfolio item" },
        { status: 403 }
      );
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
      mediaType && validMediaTypes.includes(mediaType) ? mediaType : undefined;

    const updated = await prisma.portfolioItem.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title).trim().slice(0, 200) } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(category !== undefined ? { category: category ? String(category).trim() : null } : {}),
        ...(parsedMediaType ? { mediaType: parsedMediaType } : {}),
        ...(externalUrl !== undefined ? { externalUrl: externalUrl ? String(externalUrl).trim() : null } : {}),
        ...(coverFileId !== undefined ? { coverFileId: coverFileId || null } : {}),
        ...(published !== undefined ? { published: Boolean(published) } : {}),
        ...(displayOrder !== undefined ? { displayOrder: Number(displayOrder) } : {}),
        ...(isFeatured !== undefined ? { isFeatured: Boolean(isFeatured) } : {}),
      },
      include: {
        coverFile: true,
      },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Portfolio item update error:", error);
    return NextResponse.json({ error: "Failed to update portfolio item" }, { status: 500 });
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

    const existing = await prisma.portfolioItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Portfolio item not found" }, { status: 404 });
    }

    // IDOR Protection
    if (existing.freelancerProfileId !== profile.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this portfolio item" },
        { status: 403 }
      );
    }

    await prisma.portfolioItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Portfolio item deleted" });
  } catch (error) {
    console.error("Portfolio item deletion error:", error);
    return NextResponse.json({ error: "Failed to delete portfolio item" }, { status: 500 });
  }
}
