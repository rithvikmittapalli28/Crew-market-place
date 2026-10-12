import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { realtimeBus } from "@/lib/realtime/bus";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string | null;
}

/**
 * Dispatches an in-app notification to a user, checking their notification preferences.
 */
export async function dispatchNotification({
  userId,
  type,
  title,
  body,
  linkUrl,
}: CreateNotificationParams) {
  try {
    // Check user preferences
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (pref && !pref.inAppEnabled) {
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title: title.slice(0, 191),
        body,
        linkUrl: linkUrl || null,
        isRead: false,
      },
    });

    // Compute updated unread count and publish real-time notification event
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    realtimeBus.publishNotification(userId, {
      notification,
      unreadCount,
    });

    realtimeBus.publishUnreadCount(userId, {
      type: "NOTIFICATIONS",
      unreadCount,
    });

    return notification;
  } catch (error) {
    console.error("Failed to dispatch notification:", error);
    return null;
  }
}

/**
 * Retrieves notifications for a user with unread counts.
 */
export async function getUserNotifications(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
) {
  const limit = Math.min(Math.max(1, options?.limit ?? 30), 50);
  const whereClause: { userId: string; isRead?: boolean } = { userId };

  if (options?.unreadOnly) {
    whereClause.isRead = false;
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
  ]);

  return { notifications, unreadCount };
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  const res = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  realtimeBus.publishUnreadCount(userId, {
    type: "NOTIFICATIONS",
    unreadCount,
  });

  return res;
}

/**
 * Marks all unread notifications for a user as read.
 */
export async function markAllNotificationsRead(userId: string) {
  const res = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  realtimeBus.publishUnreadCount(userId, {
    type: "NOTIFICATIONS",
    unreadCount: 0,
  });

  return res;
}
