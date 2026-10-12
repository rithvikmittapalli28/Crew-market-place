import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, logAdminAudit } from "@/lib/auth/admin";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 50);
  const cursor = url.searchParams.get("cursor");

  const [items, totalCount] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { processingStatus: "DEAD_LETTER" },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookEvent.count({
      where: { processingStatus: "DEAD_LETTER" },
    }),
  ]);

  return NextResponse.json({
    items,
    totalCount,
    nextCursor: items.length === limit ? items[items.length - 1].id : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const body = await req.json().catch(() => ({}));
  const { eventId, action, notes } = body;

  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
  }

  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return NextResponse.json({ error: "Webhook event not found" }, { status: 404 });
  }

  if (action === "RETRY") {
    // Reset to PENDING and decrement attempts to allow re-processing
    const updated = await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        processingStatus: "PENDING",
        attempts: 0,
        processingError: `Manual retry queued by admin ${auth.admin.email}`,
      },
    });

    await logAdminAudit({
      action: "WEBHOOK_DLQ_RETRY",
      entityType: "WEBHOOK_EVENT",
      entityId: eventId,
      actorId: auth.admin.id,
      metadata: { gatewayEventId: event.gatewayEventId, previousAttempts: event.attempts },
    });

    return NextResponse.json({ success: true, event: updated });
  }

  if (action === "RESOLVE") {
    const updated = await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        isProcessed: true,
        processingStatus: "RESOLVED_MANUAL",
        processingError: notes || `Resolved manually by admin ${auth.admin.email}`,
        processedAt: new Date(),
      },
    });

    await logAdminAudit({
      action: "WEBHOOK_DLQ_RESOLVE",
      entityType: "WEBHOOK_EVENT",
      entityId: eventId,
      actorId: auth.admin.id,
      metadata: { gatewayEventId: event.gatewayEventId, notes },
    });

    return NextResponse.json({ success: true, event: updated });
  }

  return NextResponse.json({ error: "Invalid action. Supported: RETRY, RESOLVE" }, { status: 400 });
}
