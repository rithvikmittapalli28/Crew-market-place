import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionRecord } from "@/lib/auth/session";
import { realtimeBus } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { conversationId } = await params;

  // 1. Authoritative session verification
  const sessionCookie = req.cookies.get("crewn_session")?.value;
  const sessionRecord = await getSessionRecord(sessionCookie);
  if (!sessionRecord?.user || !sessionRecord.user.isActive) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = sessionRecord.user.id;

  // 2. Strict conversation membership verification (Cross-tenant security barrier)
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    return new Response(
      JSON.stringify({ error: "Access denied: You are not a member of this conversation" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check for Last-Event-ID or since query parameter for reconnect catch-up
  const lastEventId = req.headers.get("last-event-id") || req.nextUrl.searchParams.get("since");

  const encoder = new TextEncoder();
  let cleanupCalled = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let sessionCheckTimer: NodeJS.Timeout | null = null;
  let unsubConv: (() => void) | null = null;
  let unsubUser: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = () => {
        if (cleanupCalled) return;
        cleanupCalled = true;

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (sessionCheckTimer) clearInterval(sessionCheckTimer);
        if (unsubConv) unsubConv();
        if (unsubUser) unsubUser();

        try {
          controller.close();
        } catch {
          // Controller might already be closed
        }
      };

      req.signal.addEventListener("abort", cleanup);

      // Send initial connected handshake event
      try {
        controller.enqueue(
          encoder.encode(
            realtimeBus.formatSse({
              event: "connected",
              data: {
                conversationId,
                userId,
                timestamp: new Date().toISOString(),
              },
              id: `conn-${Date.now()}`,
              retry: 2000,
            })
          )
        );
      } catch {
        cleanup();
        return;
      }

      // If reconnecting with lastEventId, deliver any messages created after that timestamp / message ID
      if (lastEventId) {
        try {
          let sinceDate: Date | null = null;
          // Check if lastEventId is an ISO timestamp or message ID
          if (lastEventId.includes("T") || !isNaN(Number(lastEventId))) {
            const parsed = new Date(lastEventId);
            if (!isNaN(parsed.getTime())) sinceDate = parsed;
          } else {
            // Find creation time of the message corresponding to lastEventId
            const lastMsg = await prisma.message.findUnique({
              where: { id: lastEventId },
              select: { createdAt: true },
            });
            if (lastMsg) sinceDate = lastMsg.createdAt;
          }

          if (sinceDate) {
            const missedMessages = await prisma.message.findMany({
              where: {
                conversationId,
                createdAt: { gt: sinceDate },
              },
              orderBy: { createdAt: "asc" },
              include: {
                sender: {
                  select: { id: true, name: true, email: true, avatarUrl: true, role: true },
                },
                attachments: {
                  include: {
                    file: {
                      select: {
                        id: true,
                        fileName: true,
                        mimeType: true,
                        fileSize: true,
                        storageKey: true,
                        isPublic: true,
                      },
                    },
                  },
                },
              },
            });

            for (const msg of missedMessages) {
              controller.enqueue(
                encoder.encode(
                  realtimeBus.formatSse({
                    event: "message",
                    data: msg,
                    id: msg.id,
                  })
                )
              );
            }
          }
        } catch (catchUpErr) {
          console.error("Error delivering missed SSE messages on reconnect:", catchUpErr);
        }
      }

      // Subscribe to conversation channel events
      unsubConv = realtimeBus.subscribeConversation(conversationId, (sseEvent) => {
        try {
          controller.enqueue(encoder.encode(realtimeBus.formatSse(sseEvent)));
        } catch {
          cleanup();
        }
      });

      // Subscribe to user channel for session revocation events
      unsubUser = realtimeBus.subscribeUser(userId, (sseEvent) => {
        if (sseEvent.event === "session_revoked") {
          try {
            controller.enqueue(encoder.encode(realtimeBus.formatSse(sseEvent)));
          } catch {
            // ignore
          } finally {
            cleanup();
          }
        }
      });

      // Keepalive heartbeat comment every 15 seconds to prevent gateway/proxy timeouts
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);
      heartbeatTimer.unref();

      // Periodic session validity check every 30 seconds
      sessionCheckTimer = setInterval(async () => {
        try {
          const current = await prisma.session.findUnique({
            where: { id: sessionRecord.id },
            select: { expiresAt: true, revokedAt: true },
          });

          if (!current || current.revokedAt || current.expiresAt < new Date()) {
            try {
              controller.enqueue(
                encoder.encode(
                  realtimeBus.formatSse({
                    event: "session_revoked",
                    data: { reason: "SESSION_EXPIRED" },
                    id: `revoked-${Date.now()}`,
                  })
                )
              );
            } catch {
              // ignore
            } finally {
              cleanup();
            }
          }
        } catch {
          // ignore transient db error
        }
      }, 30000);
      sessionCheckTimer.unref();
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (sessionCheckTimer) clearInterval(sessionCheckTimer);
      if (unsubConv) unsubConv();
      if (unsubUser) unsubUser();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
