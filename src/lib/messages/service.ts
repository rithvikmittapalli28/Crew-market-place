import { prisma } from "@/lib/prisma";
import { ConversationType } from "@prisma/client";
import { dispatchNotification } from "@/lib/notifications/service";

export interface SendMessageParams {
  conversationId: string;
  senderId: string;
  content: string;
  attachmentFileIds?: string[];
}

/**
 * Finds or creates an idempotent 1-on-1 direct conversation between two users.
 */
export async function getOrCreateDirectConversation(userAId: string, userBId: string) {
  if (userAId === userBId) {
    throw new Error("Cannot start a conversation with yourself");
  }

  // Ensure both users exist
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({ where: { id: userAId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: userBId }, select: { id: true, name: true } }),
  ]);

  if (!userA || !userB) {
    throw new Error("One or both users not found");
  }

  // Check if a direct conversation already exists between both users
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.DIRECT,
      AND: [
        { members: { some: { userId: userAId } } },
        { members: { some: { userId: userBId } } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
              freelancerProfile: { select: { headline: true, publicSlug: true } },
            },
          },
        },
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Create new conversation
  return await prisma.conversation.create({
    data: {
      type: ConversationType.DIRECT,
      members: {
        create: [
          { userId: userAId, lastReadAt: new Date() },
          { userId: userBId, lastReadAt: null },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
              freelancerProfile: { select: { headline: true, publicSlug: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Finds or creates the dedicated project team channel, synchronizing all project members.
 */
export async function getOrCreateProjectConversation(projectId: string, requestingUserId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
      business: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Check if requesting user has access to this project
  const isProjectMember = project.members.some((m) => m.userId === requestingUserId);
  const isBusinessMember = project.business.members.some((m) => m.userId === requestingUserId);
  const isCreator = project.createdById === requestingUserId;

  if (!isProjectMember && !isBusinessMember && !isCreator) {
    throw new Error("Access denied: You are not a member of this project");
  }

  // Build the list of all distinct user IDs who should be in this project channel
  const memberUserIds = new Set<string>();
  memberUserIds.add(project.createdById);
  for (const pm of project.members) memberUserIds.add(pm.userId);
  for (const bm of project.business.members) memberUserIds.add(bm.userId);

  const titlePrefix = `project:${projectId}:`;

  // Look for existing project channel
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.PROJECT,
      title: { startsWith: titlePrefix },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    // Create new project channel
    const created = await prisma.conversation.create({
      data: {
        type: ConversationType.PROJECT,
        title: `${titlePrefix}${project.title}`,
        members: {
          create: Array.from(memberUserIds).map((userId) => ({
            userId,
            lastReadAt: userId === requestingUserId ? new Date() : null,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return { conversation: created, project };
  }

  // Synchronize any newly added project members
  const existingMemberIds = new Set(existing.members.map((m) => m.userId));
  const missingUserIds = Array.from(memberUserIds).filter((id) => !existingMemberIds.has(id));

  if (missingUserIds.length > 0) {
    await prisma.conversationMember.createMany({
      data: missingUserIds.map((userId) => ({
        conversationId: existing.id,
        userId,
      })),
      skipDuplicates: true,
    });

    // Refetch with all members
    const updated = await prisma.conversation.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return { conversation: updated, project };
  }

  return { conversation: existing, project };
}

/**
 * Fetches all conversations where the user is a member, with unread counters and latest messages.
 */
export async function getUserConversations(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  role: true,
                  freelancerProfile: {
                    select: { headline: true, publicSlug: true },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: {
                select: { id: true, name: true, email: true },
              },
              attachments: {
                select: { id: true },
              },
            },
          },
        },
      },
    },
    orderBy: {
      conversation: {
        updatedAt: "desc",
      },
    },
  });

  const result = await Promise.all(
    memberships.map(async (m) => {
      const conv = m.conversation;
      const lastRead = m.lastReadAt ?? new Date(0);

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          createdAt: { gt: lastRead },
        },
      });

      const latestMessage = conv.messages[0] ?? null;

      // Extract display title & other participants for direct chats
      let displayTitle = conv.title || "Conversation";
      let displayAvatar: string | null = null;
      let otherParticipant: (typeof conv.members)[0]["user"] | null = null;

      if (conv.type === ConversationType.DIRECT) {
        const otherMember = conv.members.find((mem) => mem.userId !== userId);
        if (otherMember) {
          otherParticipant = otherMember.user;
          displayTitle = otherMember.user.name || otherMember.user.email;
          displayAvatar = otherMember.user.avatarUrl;
        }
      } else if (conv.type === ConversationType.PROJECT) {
        if (conv.title?.startsWith("project:")) {
          const parts = conv.title.split(":");
          displayTitle = parts.slice(2).join(":") || "Project Channel";
        }
      }

      return {
        id: conv.id,
        type: conv.type,
        title: displayTitle,
        avatarUrl: displayAvatar,
        otherParticipant,
        membersCount: conv.members.length,
        members: conv.members.map((mem) => ({
          userId: mem.userId,
          user: mem.user,
        })),
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              content: latestMessage.content,
              senderId: latestMessage.senderId,
              senderName: latestMessage.sender.name || latestMessage.sender.email,
              createdAt: latestMessage.createdAt,
              hasAttachments: latestMessage.attachments.length > 0,
            }
          : null,
        unreadCount,
        updatedAt: conv.updatedAt,
      };
    })
  );

  return result;
}

/**
 * Sends a message in a conversation and triggers notifications.
 */
export async function sendMessage({
  conversationId,
  senderId,
  content,
  attachmentFileIds,
}: SendMessageParams) {
  // Verify sender is a conversation member
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!membership) {
    throw new Error("Access denied: You are not a member of this conversation");
  }

  if (!content.trim() && (!attachmentFileIds || attachmentFileIds.length === 0)) {
    throw new Error("Message content or attachment is required");
  }

  // Create message and attach files inside a transaction
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: content.trim(),
        attachments:
          attachmentFileIds && attachmentFileIds.length > 0
            ? {
                create: attachmentFileIds.map((fileId) => ({ fileId })),
              }
            : undefined,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
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

    // Update conversation updatedAt
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Mark sender as having read up to this point
    await tx.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
      data: { lastReadAt: new Date() },
    });

    return msg;
  });

  // Asynchronously dispatch notifications to all other members
  const otherMembers = await prisma.conversationMember.findMany({
    where: {
      conversationId,
      userId: { not: senderId },
    },
    select: { userId: true },
  });

  const senderName = message.sender.name || message.sender.email;
  const preview = message.content ? message.content.slice(0, 100) : "Sent an attachment";

  for (const m of otherMembers) {
    dispatchNotification({
      userId: m.userId,
      type: "MESSAGE",
      title: `New message from ${senderName}`,
      body: preview,
      linkUrl: `/messages?c=${conversationId}`,
    }).catch((err) => console.error("Message notification error:", err));
  }

  return message;
}

/**
 * Fetches messages for a conversation, with authorization check.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  options?: { take?: number }
) {
  // Verify caller membership
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Access denied: You are not a member of this conversation");
  }

  const take = options?.take ?? 100;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
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

  return messages;
}

/**
 * Marks a conversation as read for the user.
 */
export async function markConversationAsRead(conversationId: string, userId: string) {
  return await prisma.conversationMember.updateMany({
    where: {
      conversationId,
      userId,
    },
    data: {
      lastReadAt: new Date(),
    },
  });
}
