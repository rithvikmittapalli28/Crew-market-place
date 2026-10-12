import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { hashToken } from "../src/lib/auth/session";
import { realtimeBus } from "../src/lib/realtime/bus";
import {
  getOrCreateDirectConversation,
  getOrCreateProjectConversation,
  sendMessage,
  markConversationAsRead,
} from "../src/lib/messages/service";
import {
  dispatchNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from "../src/lib/notifications/service";
import { GET as getConversationEvents } from "../src/app/api/conversations/[conversationId]/events/route";
import { GET as getNotificationEvents } from "../src/app/api/notifications/events/route";

// Helper: parse SSE string chunks into structured event objects
function parseSseEvents(text: string): Array<{ event: string; data: any; id?: string }> {
  const events: Array<{ event: string; data: any; id?: string }> = [];
  const blocks = text.split("\n\n").filter(Boolean);

  for (const block of blocks) {
    if (block.startsWith(":")) continue; // comment / keepalive
    let eventName = "message";
    let dataStr = "";
    let id: string | undefined;

    const lines = block.split("\n");
    for (const line of lines) {
      if (line.startsWith("event: ")) eventName = line.slice(7).trim();
      else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
      else if (line.startsWith("id: ")) id = line.slice(4).trim();
    }

    if (dataStr) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataStr), id });
      } catch {
        events.push({ event: eventName, data: dataStr, id });
      }
    }
  }

  return events;
}

// Helper: Read from a ReadableStream reader until at least one event matching criteria is found
async function readNextSseEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  timeoutMs = 4000
): Promise<{ event: string; data: any; id?: string }> {
  let accumulated = "";
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const readPromise = reader.read();
    const timeoutPromise = new Promise<{ value: undefined; done: boolean }>((resolve) =>
      setTimeout(() => resolve({ value: undefined, done: false }), 200)
    );

    const result = await Promise.race([readPromise, timeoutPromise]);
    if (result.value) {
      accumulated += decoder.decode(result.value, { stream: true });
      const parsed = parseSseEvents(accumulated);
      if (parsed.length > 0) {
        return parsed[0];
      }
    }
    if (result.done) break;
  }

  throw new Error(`Timeout waiting for SSE event. Accumulated text:\n${accumulated}`);
}

test("Phase 9: Real-Time Communications & Server-Sent Events Suite", async (t) => {
  const timestamp = Date.now();
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let outsiderUser: { id: string; email: string };
  let tokenA: string;
  let tokenB: string;
  let tokenOutsider: string;
  let sessionAId: string;
  let sessionBId: string;
  let directConv: { id: string };
  let projectConv: { id: string };
  let business: { id: string };
  let project: { id: string };

  t.before(async () => {
    // 1. Create test users
    userA = await prisma.user.create({
      data: {
        email: `client-sse-${timestamp}@crewn.test`,
        name: "SSE Client Owner",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    userB = await prisma.user.create({
      data: {
        email: `creator-sse-${timestamp}@crewn.test`,
        name: "SSE Creator Expert",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    outsiderUser = await prisma.user.create({
      data: {
        email: `outsider-sse-${timestamp}@crewn.test`,
        name: "SSE Outsider",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    // 2. Create authoritative sessions
    tokenA = crypto.randomBytes(32).toString("hex");
    tokenB = crypto.randomBytes(32).toString("hex");
    tokenOutsider = crypto.randomBytes(32).toString("hex");

    const sessionA = await prisma.session.create({
      data: {
        userId: userA.id,
        tokenHash: hashToken(tokenA),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });
    sessionAId = sessionA.id;

    const sessionB = await prisma.session.create({
      data: {
        userId: userB.id,
        tokenHash: hashToken(tokenB),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });
    sessionBId = sessionB.id;

    await prisma.session.create({
      data: {
        userId: outsiderUser.id,
        tokenHash: hashToken(tokenOutsider),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        lastReauthenticatedAt: new Date(),
      },
    });

    // 3. Create Direct Conversation between User A & User B
    directConv = await getOrCreateDirectConversation(userA.id, userB.id);

    // 4. Create Business and Project for Team Channel
    business = await prisma.business.create({
      data: {
        name: `SSE Production Studio ${timestamp}`,
        slug: `sse-studio-${timestamp}`,
        members: {
          create: [{ userId: userA.id, role: "OWNER" }],
        },
      },
      select: { id: true },
    });

    project = await prisma.project.create({
      data: {
        businessId: business.id,
        createdById: userA.id,
        title: `SSE Campaign Video ${timestamp}`,
        description: "SSE Project channel test",
        status: "IN_PROGRESS",
        members: {
          create: [
            { userId: userA.id, role: "OWNER" },
            { userId: userB.id, role: "FREELANCER" },
          ],
        },
      },
      select: { id: true },
    });

    const projectRes = await getOrCreateProjectConversation(project.id, userA.id);
    projectConv = projectRes.conversation;
  });

  t.after(async () => {
    // Clean up test data
    await prisma.message.deleteMany({
      where: { conversationId: { in: [directConv.id, projectConv.id] } },
    });
    await prisma.conversationMember.deleteMany({
      where: { conversationId: { in: [directConv.id, projectConv.id] } },
    });
    await prisma.conversation.deleteMany({
      where: { id: { in: [directConv.id, projectConv.id] } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [userA.id, userB.id, outsiderUser.id] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userA.id, userB.id, outsiderUser.id] } },
    });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.deleteMany({ where: { id: project.id } });
    await prisma.businessMember.deleteMany({ where: { businessId: business.id } });
    await prisma.business.deleteMany({ where: { id: business.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, outsiderUser.id] } },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Authorized SSE connection (Notifications endpoint)
  // ---------------------------------------------------------------------------
  await t.test("1. Authorized SSE connection connects and yields connected handshake", async () => {
    const req = new NextRequest("http://localhost:3000/api/notifications/events", {
      headers: {
        cookie: `crewn_session=${tokenA}`,
      },
    });

    const res = await getNotificationEvents(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
    assert.equal(res.headers.get("Cache-Control"), "no-cache, no-transform");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const event = await readNextSseEvent(reader, decoder);

    assert.equal(event.event, "connected");
    assert.equal(event.data.userId, userA.id);
    assert.equal(typeof event.data.unreadCount, "number");

    await reader.cancel();
  });

  // ---------------------------------------------------------------------------
  // 2. Unauthorized connection rejection
  // ---------------------------------------------------------------------------
  await t.test("2. Unauthorized requests are strictly rejected with 401", async () => {
    // Missing session cookie
    const reqNoAuth = new NextRequest("http://localhost:3000/api/notifications/events");
    const resNoAuth = await getNotificationEvents(reqNoAuth);
    assert.equal(resNoAuth.status, 401);

    // Invalid / forged session cookie
    const reqInvalid = new NextRequest("http://localhost:3000/api/notifications/events", {
      headers: {
        cookie: "crewn_session=bad-forged-token-12345",
      },
    });
    const resInvalid = await getNotificationEvents(reqInvalid);
    assert.equal(resInvalid.status, 401);
  });

  // ---------------------------------------------------------------------------
  // 3. Conversation membership authorization barrier & cross-user isolation
  // ---------------------------------------------------------------------------
  await t.test("3. Conversation SSE rejects unauthorized non-members with 403", async () => {
    // Outsider tries to connect to directConv between User A & User B
    const reqOutsider = new NextRequest(
      `http://localhost:3000/api/conversations/${directConv.id}/events`,
      {
        headers: {
          cookie: `crewn_session=${tokenOutsider}`,
        },
      }
    );

    const resOutsider = await getConversationEvents(reqOutsider, {
      params: Promise.resolve({ conversationId: directConv.id }),
    });

    assert.equal(resOutsider.status, 403);
    const body = await resOutsider.json();
    assert.match(body.error, /Access denied/);
  });

  // ---------------------------------------------------------------------------
  // 4. Authorized conversation SSE connection & message event delivery
  // ---------------------------------------------------------------------------
  await t.test("4. Message event delivery over conversation SSE stream without page reload", async () => {
    // User B connects to the conversation SSE stream
    const reqB = new NextRequest(
      `http://localhost:3000/api/conversations/${directConv.id}/events`,
      {
        headers: {
          cookie: `crewn_session=${tokenB}`,
        },
      }
    );

    const resB = await getConversationEvents(reqB, {
      params: Promise.resolve({ conversationId: directConv.id }),
    });

    assert.equal(resB.status, 200);
    const reader = resB.body!.getReader();
    const decoder = new TextDecoder();

    // Consume the initial handshake
    const handshake = await readNextSseEvent(reader, decoder);
    assert.equal(handshake.event, "connected");

    // User A sends a message in the direct conversation
    const sentMessage = await sendMessage({
      conversationId: directConv.id,
      senderId: userA.id,
      content: "Real-time message delivered via SSE!",
    });

    // User B should receive the message event immediately on the active stream
    const messageEvent = await readNextSseEvent(reader, decoder);
    assert.equal(messageEvent.event, "message");
    assert.equal(messageEvent.data.id, sentMessage.id);
    assert.equal(messageEvent.data.content, "Real-time message delivered via SSE!");
    assert.equal(messageEvent.data.senderId, userA.id);

    await reader.cancel();
  });

  // ---------------------------------------------------------------------------
  // 5. Notification event delivery & unread count updates
  // ---------------------------------------------------------------------------
  await t.test("5. Real-time notification and unread-count event delivery", async () => {
    // User B connects to notifications SSE stream
    const reqB = new NextRequest("http://localhost:3000/api/notifications/events", {
      headers: {
        cookie: `crewn_session=${tokenB}`,
      },
    });

    const resB = await getNotificationEvents(reqB);
    assert.equal(resB.status, 200);
    const reader = resB.body!.getReader();
    const decoder = new TextDecoder();

    // Consume handshake
    await readNextSseEvent(reader, decoder);

    // Dispatch notification to User B
    const notif = await dispatchNotification({
      userId: userB.id,
      type: "PAYMENT",
      title: "Escrow Milestone Released",
      body: "Milestone 1 funds of $1,500 are ready for withdrawal",
      linkUrl: "/dashboard",
    });
    assert.ok(notif);

    // User B's stream receives the notification event
    const notifEvent = await readNextSseEvent(reader, decoder);
    assert.equal(notifEvent.event, "notification");
    assert.equal(notifEvent.data.notification.id, notif.id);
    assert.equal(notifEvent.data.notification.title, "Escrow Milestone Released");
    assert.equal(typeof notifEvent.data.unreadCount, "number");
    assert.ok(notifEvent.data.unreadCount >= 1);

    await reader.cancel();
  });

  // ---------------------------------------------------------------------------
  // 6. Read / unread count synchronization
  // ---------------------------------------------------------------------------
  await t.test("6. Mark read synchronizes unread counts and read receipts", async () => {
    // 1. Send another message from User A to User B
    const msg = await sendMessage({
      conversationId: directConv.id,
      senderId: userA.id,
      content: "Unread counter verification message",
    });
    assert.ok(msg);

    // 2. Mark conversation as read by User B
    const readReceipt = await markConversationAsRead(directConv.id, userB.id);
    assert.ok(readReceipt.count >= 1);

    // 3. Verify User B unread count for this conversation in DB is 0
    const memberB = await prisma.conversationMember.findUniqueOrThrow({
      where: {
        conversationId_userId: {
          conversationId: directConv.id,
          userId: userB.id,
        },
      },
    });

    const unreadCount = await prisma.message.count({
      where: {
        conversationId: directConv.id,
        senderId: { not: userB.id },
        createdAt: { gt: memberB.lastReadAt! },
      },
    });
    assert.equal(unreadCount, 0);
  });

  // ---------------------------------------------------------------------------
  // 7. Reconnect catch-up via Last-Event-ID without duplicates
  // ---------------------------------------------------------------------------
  await t.test("7. Reconnect with Last-Event-ID catches up on missed messages", async () => {
    // Create two new messages
    const msg1 = await sendMessage({
      conversationId: directConv.id,
      senderId: userA.id,
      content: "Message before reconnect point",
    });

    // Simulating reconnect with since = msg1.createdAt or last-event-id = msg1.id
    const msg2 = await sendMessage({
      conversationId: directConv.id,
      senderId: userA.id,
      content: "Message after reconnect point (should be delivered)",
    });

    const reqReconnect = new NextRequest(
      `http://localhost:3000/api/conversations/${directConv.id}/events`,
      {
        headers: {
          cookie: `crewn_session=${tokenB}`,
          "last-event-id": msg1.id,
        },
      }
    );

    const resReconnect = await getConversationEvents(reqReconnect, {
      params: Promise.resolve({ conversationId: directConv.id }),
    });

    assert.equal(resReconnect.status, 200);
    const reader = resReconnect.body!.getReader();
    const decoder = new TextDecoder();

    // 1. Handshake
    const handshake = await readNextSseEvent(reader, decoder);
    assert.equal(handshake.event, "connected");

    // 2. Catch-up missed message (msg2)
    const catchUpEvent = await readNextSseEvent(reader, decoder);
    assert.equal(catchUpEvent.event, "message");
    assert.equal(catchUpEvent.data.id, msg2.id);
    assert.equal(catchUpEvent.data.content, msg2.content);

    await reader.cancel();
  });

  // ---------------------------------------------------------------------------
  // 8. Multiple browser tabs (concurrent subscriptions) for the same user
  // ---------------------------------------------------------------------------
  await t.test("8. Multiple tabs for same user both receive real-time notifications", async () => {
    // Tab 1
    const reqTab1 = new NextRequest("http://localhost:3000/api/notifications/events", {
      headers: { cookie: `crewn_session=${tokenB}` },
    });
    const resTab1 = await getNotificationEvents(reqTab1);
    const reader1 = resTab1.body!.getReader();
    const decoder1 = new TextDecoder();
    await readNextSseEvent(reader1, decoder1); // consume handshake

    // Tab 2
    const reqTab2 = new NextRequest("http://localhost:3000/api/notifications/events", {
      headers: { cookie: `crewn_session=${tokenB}` },
    });
    const resTab2 = await getNotificationEvents(reqTab2);
    const reader2 = resTab2.body!.getReader();
    const decoder2 = new TextDecoder();
    await readNextSseEvent(reader2, decoder2); // consume handshake

    // Dispatch an event
    const multiTabNotif = await dispatchNotification({
      userId: userB.id,
      type: "MESSAGE",
      title: "Multi-tab Test Notification",
      body: "Testing multi-tab fan-out",
    });

    // Both tabs receive the notification
    const eventTab1 = await readNextSseEvent(reader1, decoder1);
    const eventTab2 = await readNextSseEvent(reader2, decoder2);

    assert.equal(eventTab1.data.notification.id, multiTabNotif!.id);
    assert.equal(eventTab2.data.notification.id, multiTabNotif!.id);

    await reader1.cancel();
    await reader2.cancel();
  });

  // ---------------------------------------------------------------------------
  // 9. Revoked / expired session disconnects SSE stream
  // ---------------------------------------------------------------------------
  await t.test("9. Revoked session terminates SSE connection", async () => {
    const reqRevoke = new NextRequest("http://localhost:3000/api/notifications/events", {
      headers: { cookie: `crewn_session=${tokenA}` },
    });

    const resRevoke = await getNotificationEvents(reqRevoke);
    const reader = resRevoke.body!.getReader();
    const decoder = new TextDecoder();

    // Consume handshake
    await readNextSseEvent(reader, decoder);

    // Simulate session revocation event publication
    realtimeBus.publishSessionRevocation(userA.id, {
      reason: "SESSION_REVOKED",
      sessionId: sessionAId,
    });

    // Active connection receives session_revoked event
    const revokedEvent = await readNextSseEvent(reader, decoder);
    assert.equal(revokedEvent.event, "session_revoked");
    assert.equal(revokedEvent.data.reason, "SESSION_REVOKED");

    await reader.cancel();
  });
});
