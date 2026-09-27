import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  getOrCreateDirectConversation,
  getOrCreateProjectConversation,
  getUserConversations,
  sendMessage,
  getConversationMessages,
  markConversationAsRead,
} from "../src/lib/messages/service";
import {
  dispatchNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../src/lib/notifications/service";

test("Phase 6: Messaging, Team Channels & In-App Notifications", async (t) => {
  const timestamp = Date.now();
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let outsider: { id: string; email: string };
  let business: { id: string };
  let project: { id: string };
  let testFile: { id: string };

  t.before(async () => {
    // 1. Create test users
    userA = await prisma.user.create({
      data: {
        email: `client-phase6-${timestamp}@crewn.test`,
        name: "Phase 6 Business Owner",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    userB = await prisma.user.create({
      data: {
        email: `creator-phase6-${timestamp}@crewn.test`,
        name: "Phase 6 Elite Editor",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    outsider = await prisma.user.create({
      data: {
        email: `outsider-phase6-${timestamp}@crewn.test`,
        name: "Phase 6 Outsider",
        role: "FREELANCER",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });

    // 2. Create business and project
    business = await prisma.business.create({
      data: {
        name: `Crewn Phase 6 Studio ${timestamp}`,
        slug: `phase6-studio-${timestamp}`,
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
        title: `Cinematic Commercial ${timestamp}`,
        description: "Phase 6 project collaboration campaign",
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

    // 3. Create dummy file for attachment
    testFile = await prisma.file.create({
      data: {
        uploadedById: userA.id,
        storageKey: `test-brief-${timestamp}.pdf`,
        fileName: "Creative_Brief_v1.pdf",
        mimeType: "application/pdf",
        fileSize: 1048576,
        isPublic: false,
      },
      select: { id: true },
    });
  });

  t.after(async () => {
    // Cleanup in reverse dependency order
    await prisma.notification.deleteMany({
      where: { userId: { in: [userA.id, userB.id, outsider.id] } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [userA.id, userB.id, outsider.id] } },
    });
    await prisma.messageAttachment.deleteMany({
      where: { fileId: testFile.id },
    });
    await prisma.message.deleteMany({
      where: { senderId: { in: [userA.id, userB.id, outsider.id] } },
    });
    await prisma.conversationMember.deleteMany({
      where: { userId: { in: [userA.id, userB.id, outsider.id] } },
    });
    await prisma.conversation.deleteMany({
      where: { title: { contains: `${timestamp}` } },
    });
    await prisma.file.deleteMany({
      where: { id: testFile.id },
    });
    await prisma.projectMember.deleteMany({
      where: { projectId: project.id },
    });
    await prisma.project.deleteMany({
      where: { id: project.id },
    });
    await prisma.businessMember.deleteMany({
      where: { businessId: business.id },
    });
    await prisma.business.deleteMany({
      where: { id: business.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, outsider.id] } },
    });
  });

  let directConvId: string;
  let projectConvId: string;

  await t.test("1. Direct 1-on-1 Conversation Lifecycle & Idempotency", async () => {
    // A. Create direct conversation between userA and userB
    const conv1 = await getOrCreateDirectConversation(userA.id, userB.id);
    assert.ok(conv1.id, "Conversation ID should exist");
    assert.equal(conv1.type, "DIRECT");
    assert.equal(conv1.members.length, 2);
    directConvId = conv1.id;

    // B. Re-call with inverted user order: must be idempotent and return identical conversation
    const conv2 = await getOrCreateDirectConversation(userB.id, userA.id);
    assert.equal(conv2.id, conv1.id, "Direct conversation must be idempotent across participant ordering");

    // C. Rejects self-conversation
    await assert.rejects(
      async () => await getOrCreateDirectConversation(userA.id, userA.id),
      /Cannot start a conversation with yourself/
    );
  });

  await t.test("2. Project Team Channel Creation & Auto-Syncing", async () => {
    // A. Open project channel for authorized project member
    const { conversation, project: proj } = await getOrCreateProjectConversation(project.id, userA.id);
    assert.ok(conversation.id);
    assert.equal(conversation.type, "PROJECT");
    assert.ok(conversation.title?.startsWith(`project:${project.id}:`));
    projectConvId = conversation.id;

    // B. Verify both project members were enrolled
    const memberIds = conversation.members.map((m) => m.userId);
    assert.ok(memberIds.includes(userA.id));
    assert.ok(memberIds.includes(userB.id));

    // C. Unauthorized user cannot access project channel
    await assert.rejects(
      async () => await getOrCreateProjectConversation(project.id, outsider.id),
      /Access denied/
    );

    // D. When a new member joins project, channel auto-syncs them
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: outsider.id,
        role: "TEAM_MEMBER",
      },
    });

    const synced = await getOrCreateProjectConversation(project.id, userB.id);
    const updatedMemberIds = synced.conversation.members.map((m) => m.userId);
    assert.ok(updatedMemberIds.includes(outsider.id), "New project member was automatically enrolled in channel");
  });

  await t.test("3. Message Sending, Attachments & Read Tracking", async () => {
    // A. User A sends a message with an attachment in the direct conversation
    const msg1 = await sendMessage({
      conversationId: directConvId,
      senderId: userA.id,
      content: "Hello! Here is the creative brief for the campaign.",
      attachmentFileIds: [testFile.id],
    });

    assert.ok(msg1.id);
    assert.equal(msg1.content, "Hello! Here is the creative brief for the campaign.");
    assert.equal(msg1.attachments.length, 1);
    assert.equal(msg1.attachments[0].file.fileName, "Creative_Brief_v1.pdf");

    // B. Outsider cannot send message to direct conversation
    await assert.rejects(
      async () =>
        await sendMessage({
          conversationId: directConvId,
          senderId: outsider.id,
          content: "Unauthorized intrusion",
        }),
      /Access denied/
    );

    // C. Outsider cannot read messages from direct conversation
    await assert.rejects(
      async () => await getConversationMessages(directConvId, outsider.id),
      /Access denied/
    );

    // D. User B reads messages and unread counter is verified
    const userBConvsBefore = await getUserConversations(userB.id);
    const targetConvBefore = userBConvsBefore.find((c) => c.id === directConvId);
    assert.ok(targetConvBefore, "Conversation must appear in user B list");
    assert.equal(targetConvBefore.unreadCount, 1, "User B should have 1 unread message");

    // E. User B marks conversation as read
    await markConversationAsRead(directConvId, userB.id);

    const userBConvsAfter = await getUserConversations(userB.id);
    const targetConvAfter = userBConvsAfter.find((c) => c.id === directConvId);
    assert.equal(targetConvAfter?.unreadCount, 0, "Unread count should be 0 after reading");
  });

  await t.test("4. In-App Notifications & Preference Management", async () => {
    // A. Dispatch a payment notification to user B
    const notif = await dispatchNotification({
      userId: userB.id,
      type: "PAYMENT",
      title: "Escrow Secured",
      body: "Milestone funds of ₹25,000 have been secured in escrow.",
      linkUrl: `/projects/${project.id}`,
    });

    assert.ok(notif?.id);
    assert.equal(notif.isRead, false);

    // B. Check user notifications list
    const { notifications, unreadCount } = await getUserNotifications(userB.id);
    assert.ok(unreadCount >= 1);
    const found = notifications.find((n) => n.id === notif.id);
    assert.ok(found, "Notification should be in user notification list");

    // C. Mark single notification as read
    await markNotificationRead(notif.id, userB.id);
    const updated = await getUserNotifications(userB.id, { unreadOnly: true });
    const stillUnread = updated.notifications.some((n) => n.id === notif.id);
    assert.equal(stillUnread, false, "Notification should no longer be unread");

    // D. Test bulk mark-all-read
    await dispatchNotification({
      userId: userB.id,
      type: "TASK",
      title: "Task Assigned",
      body: "Color Grading task assigned to you.",
    });

    await markAllNotificationsRead(userB.id);
    const { unreadCount: zeroUnread } = await getUserNotifications(userB.id);
    assert.equal(zeroUnread, 0, "Bulk mark all read should leave 0 unread notifications");

    // E. Verify preference enforcement: if inAppEnabled is false, no notification is inserted
    await prisma.notificationPreference.upsert({
      where: { userId: userB.id },
      update: { inAppEnabled: false },
      create: { userId: userB.id, inAppEnabled: false },
    });

    const suppressed = await dispatchNotification({
      userId: userB.id,
      type: "SYSTEM",
      title: "Silent Alert",
      body: "This should be suppressed.",
    });
    assert.equal(suppressed, null, "Notification should be suppressed when inAppEnabled is false");
  });
});
