import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionRecord } from "@/lib/auth/session";
import { realtimeBus } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

  // 2. Fetch initial unread count
  const initialUnreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  const encoder = new TextEncoder();
  let cleanupCalled = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let sessionCheckTimer: NodeJS.Timeout | null = null;
  let unsubUser: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const cleanup = () => {
        if (cleanupCalled) return;
        cleanupCalled = true;

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (sessionCheckTimer) clearInterval(sessionCheckTimer);
        if (unsubUser) unsubUser();

        try {
          controller.close();
        } catch {
          // Controller might already be closed
        }
      };

      req.signal.addEventListener("abort", cleanup);

      // Send initial connected handshake event with initial unread count
      try {
        controller.enqueue(
          encoder.encode(
            realtimeBus.formatSse({
              event: "connected",
              data: {
                userId,
                unreadCount: initialUnreadCount,
                timestamp: new Date().toISOString(),
              },
              id: `conn-user-${Date.now()}`,
              retry: 2000,
            })
          )
        );
      } catch {
        cleanup();
        return;
      }

      // Subscribe to user channel events (notifications, unread count changes, conversation updates)
      unsubUser = realtimeBus.subscribeUser(userId, (sseEvent) => {
        if (sseEvent.event === "session_revoked") {
          try {
            controller.enqueue(encoder.encode(realtimeBus.formatSse(sseEvent)));
          } catch {
            // ignore
          } finally {
            cleanup();
          }
          return;
        }

        try {
          controller.enqueue(encoder.encode(realtimeBus.formatSse(sseEvent)));
        } catch {
          cleanup();
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
