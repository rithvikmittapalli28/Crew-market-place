import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocalStorageDir, verifySignedUrlToken } from "@/lib/storage";

interface RouteParams {
  params: Promise<{ key: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey || "").trim();

    // 1. Strict storage key validation: prevent path traversal (.., /, \, null bytes)
    if (!key || !/^[a-zA-Z0-9_\-\.]+$/.test(key) || key.includes("..")) {
      return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
    }

    // 2. Database validation: file MUST exist in PostgreSQL.
    // This strictly prevents arbitrary filesystem inspection or access to unindexed host files.
    const fileRecord = await prisma.file.findUnique({
      where: { storageKey: key },
    });

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 3. Authorization check: public vs private
    if (!fileRecord.isPublic) {
      const searchParams = req.nextUrl.searchParams;
      const token = searchParams.get("token");
      const expires = searchParams.get("expires");

      let isAuthorized = false;

      // Option A: Valid short-lived signed URL token
      if (token && expires) {
        const sigResult = verifySignedUrlToken(key, token, expires);
        if (sigResult.isValid) {
          isAuthorized = true;
        } else {
          return NextResponse.json(
            { error: sigResult.error || "Invalid or expired signature" },
            { status: 403 }
          );
        }
      }

      // Option B: Authenticated session ownership check
      if (!isAuthorized) {
        const sessionUser = await getCurrentUser();
        if (!sessionUser) {
          return NextResponse.json(
            { error: "Access denied. Private files require a valid signed URL or active session." },
            { status: 401 }
          );
        }

        // Check if user is the uploader
        if (sessionUser.id === fileRecord.uploadedById) {
          isAuthorized = true;
        } else if (fileRecord.resourceType === "INVOICE" && fileRecord.resourceId) {
          const invoice = await prisma.invoice.findUnique({
            where: { id: fileRecord.resourceId },
          });
          if (invoice) {
            if (invoice.recipientId === sessionUser.id) {
              isAuthorized = true;
            } else {
              const isBizMember = await prisma.businessMember.findFirst({
                where: { businessId: invoice.businessId, userId: sessionUser.id },
              });
              if (isBizMember) isAuthorized = true;
            }
          }
        } else if (fileRecord.projectId) {
          // Check project membership
          const membership = await prisma.projectMember.findFirst({
            where: {
              projectId: fileRecord.projectId,
              userId: sessionUser.id,
            },
          });
          if (membership) isAuthorized = true;
        }

        // Check if file is attached to a conversation the user belongs to
        if (!isAuthorized) {
          const conversationMember = await prisma.conversationMember.findFirst({
            where: {
              userId: sessionUser.id,
              conversation: {
                messages: {
                  some: {
                    attachments: {
                      some: {
                        fileId: fileRecord.id,
                      },
                    },
                  },
                },
              },
            },
          });
          if (conversationMember) {
            isAuthorized = true;
          }
        }

        // Check if file is attached to a dispute message the user participates in
        if (!isAuthorized) {
          const disputeParticipant = await prisma.dispute.findFirst({
            where: {
              OR: [
                { initiatorId: sessionUser.id },
                { respondentId: sessionUser.id },
              ],
              messages: {
                some: {
                  attachmentFileId: fileRecord.id,
                },
              },
            },
          });
          if (disputeParticipant) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          return NextResponse.json(
            { error: "Forbidden: You do not have permission to access this private file." },
            { status: 403 }
          );
        }
      }
    }

    // 4. Safe filesystem path resolution
    const baseDir = getLocalStorageDir();
    const safeKey = path.basename(key);
    const resolvedPath = path.resolve(baseDir, safeKey);

    // Strict path containment check
    if (!resolvedPath.startsWith(baseDir)) {
      return NextResponse.json({ error: "Path traversal rejected" }, { status: 403 });
    }

    let targetFilePath = resolvedPath;
    if (!fs.existsSync(/*turbopackIgnore: true*/ targetFilePath)) {
      // Fallback check in public/uploads for existing seed assets
      const fallbackPath = path.resolve(process.cwd(), "public", "uploads", safeKey);
      if (
        fs.existsSync(/*turbopackIgnore: true*/ fallbackPath) &&
        fallbackPath.startsWith(path.resolve(process.cwd(), "public", "uploads"))
      ) {
        targetFilePath = fallbackPath;
      } else {
        return NextResponse.json({ error: "Storage object missing on disk" }, { status: 404 });
      }
    }

    // 5. Read and stream file buffer
    const fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ targetFilePath);

    const headers = new Headers();
    headers.set("Content-Type", fileRecord.mimeType || "application/octet-stream");
    headers.set("Content-Length", fileBuffer.length.toString());
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(fileRecord.fileName)}"`
    );

    if (fileRecord.isPublic) {
      headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
    } else {
      headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "Internal server error serving file" }, { status: 500 });
  }
}
