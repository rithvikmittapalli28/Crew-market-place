import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getStorageProvider,
  isAllowedMimeType,
  MAX_FILE_SIZE_BYTES,
  validateFileSignature,
  sanitizeFileName,
  generateStorageKey,
  LocalStorageProvider,
} from "@/lib/storage";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 40 uploads per 5 minutes per user/IP
    const ip = getClientIp(req);
    const limitResult = await rateLimit(`upload:${user.id}:${ip}`, 40, 5 * 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Server-side file size validation: check Content-Length header early
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Payload exceeds maximum server limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as globalThis.File | null;
    const resourceType = formData.get("resourceType") as string | null;
    const resourceId = formData.get("resourceId") as string | null;
    const isPublicParam = formData.get("isPublic") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Server-side file size validation on file object
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds the server limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    // 4. Declared content-type check
    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { error: `File type '${file.type}' is not allowed` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 5. Server-side file size validation on actual buffer
    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Buffer size exceeds the server limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    // 6. Magic bytes / file signature validation (content-type vs actual content)
    const signatureValidation = validateFileSignature(buffer, file.type);
    if (!signatureValidation.isValid) {
      return NextResponse.json(
        { error: signatureValidation.error || "File signature does not match declared type" },
        { status: 400 }
      );
    }

    const verifiedMimeType = signatureValidation.detectedMimeType || file.type;

    // 7. Resource Ownership Validation: A user must only upload files for resources they own
    let validatedResourceType = resourceType || "PORTFOLIO_ITEM";
    let validatedResourceId: string | null = null;
    let isPublicFile = isPublicParam !== null ? isPublicParam === "true" : true;

    if (resourceType === "PORTFOLIO_ITEM") {
      // Must own the freelancer profile
      const freelancerProfile = await prisma.freelancerProfile.findUnique({
        where: { userId: user.id },
      });

      if (!freelancerProfile) {
        return NextResponse.json(
          { error: "Freelancer profile required to upload portfolio items" },
          { status: 403 }
        );
      }

      if (resourceId) {
        // If specific portfolio item ID passed, verify ownership
        const portfolioItem = await prisma.portfolioItem.findUnique({
          where: { id: resourceId },
        });

        if (portfolioItem && portfolioItem.freelancerProfileId !== freelancerProfile.id) {
          return NextResponse.json(
            { error: "You do not own this portfolio item" },
            { status: 403 }
          );
        }
        validatedResourceId = resourceId;
      } else {
        validatedResourceId = freelancerProfile.id;
      }
      // Portfolio media is public by default unless explicitly set
      if (isPublicParam === null) isPublicFile = true;
    } else if (resourceType === "PROFILE_AVATAR") {
      if (resourceId && resourceId !== user.id) {
        const fp = await prisma.freelancerProfile.findUnique({ where: { userId: user.id } });
        const bm = await prisma.businessMember.findFirst({
          where: { userId: user.id, businessId: resourceId },
        });
        if (fp?.id !== resourceId && !bm) {
          return NextResponse.json(
            { error: "You cannot upload an avatar for a profile you do not own" },
            { status: 403 }
          );
        }
      }
      validatedResourceId = resourceId || user.id;
      if (isPublicParam === null) isPublicFile = true;
    } else if (resourceType === "SERVICE_IMAGE") {
      const freelancerProfile = await prisma.freelancerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!freelancerProfile) {
        return NextResponse.json({ error: "Forbidden: Not a freelancer" }, { status: 403 });
      }
      if (resourceId) {
        const service = await prisma.service.findUnique({ where: { id: resourceId } });
        if (service && service.freelancerProfileId !== freelancerProfile.id) {
          return NextResponse.json(
            { error: "You do not own this service" },
            { status: 403 }
          );
        }
      }
      validatedResourceId = resourceId || freelancerProfile.id;
      if (isPublicParam === null) isPublicFile = true;
    } else if (resourceType === "PROJECT_DELIVERABLE" || resourceType === "PROJECT_FILE") {
      if (!resourceId) {
        return NextResponse.json(
          { error: "Project ID required for project file uploads" },
          { status: 400 }
        );
      }
      // Check project membership or ownership
      const isMember = await prisma.projectMember.findFirst({
        where: { projectId: resourceId, userId: user.id },
      });
      const isOwner = await prisma.project.findFirst({
        where: { id: resourceId, business: { members: { some: { userId: user.id } } } },
      });

      if (!isMember && !isOwner) {
        return NextResponse.json(
          { error: "Forbidden: You are not a member of this project" },
          { status: 403 }
        );
      }
      validatedResourceId = resourceId;
      // Project files are private by default
      if (isPublicParam === null) isPublicFile = false;
    } else {
      // Default to general user resource
      validatedResourceType = "USER_RESOURCE";
      validatedResourceId = user.id;
    }

    // 8. Sanitize original filename (never used in storage path)
    const sanitizedName = sanitizeFileName(file.name);

    // 9. Generate server-side storage key (never includes user-provided filename)
    const storageKey = generateStorageKey(user.id, verifiedMimeType);

    // 10. Persist file via StorageProvider
    const provider = getStorageProvider();
    let fileUrl: string;

    if (provider instanceof LocalStorageProvider) {
      await provider.saveBuffer(storageKey, buffer);
      fileUrl = await provider.getFileUrl(storageKey, isPublicFile);
    } else {
      fileUrl = await provider.getFileUrl(storageKey, isPublicFile);
    }

    // 11. Create File record with ownership metadata in PostgreSQL
    const dbFile = await prisma.file.create({
      data: {
        storageKey,
        fileName: sanitizedName,
        mimeType: verifiedMimeType,
        fileSize: BigInt(buffer.byteLength),
        uploadedById: user.id,
        resourceType: validatedResourceType,
        resourceId: validatedResourceId,
        isPublic: isPublicFile,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: dbFile.id,
        storageKey: dbFile.storageKey,
        fileName: dbFile.fileName,
        mimeType: dbFile.mimeType,
        fileSize: Number(dbFile.fileSize),
        resourceType: dbFile.resourceType,
        resourceId: dbFile.resourceId,
        isPublic: dbFile.isPublic,
        url: fileUrl,
      },
    });
  } catch (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
