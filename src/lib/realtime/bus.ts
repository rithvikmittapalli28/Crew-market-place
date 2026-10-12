import { EventEmitter } from "events";
import Redis from "ioredis";
import { getRedisClient, getRedisSubscriber } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

export interface SseEventData {
  event: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export interface ConversationMessageEvent {
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: Date | string;
    sender: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
      role: string;
    };
    attachments?: Array<{
      id: string;
      file: {
        id: string;
        fileName: string;
        mimeType: string;
        fileSize: number | bigint;
        storageKey: string;
        isPublic: boolean;
      };
    }>;
  };
}

export interface ConversationReadEvent {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}

export interface NotificationEvent {
  notification: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: Date | string;
  };
  unreadCount: number;
}

export interface UnreadCountEvent {
  type: "NOTIFICATIONS" | "MESSAGES";
  unreadCount: number;
  conversationId?: string;
}

export interface UserConversationMessageEvent {
  conversationId: string;
  message: ConversationMessageEvent["message"];
  unreadCount: number;
}

export interface SessionRevokedEvent {
  reason: "SESSION_EXPIRED" | "SESSION_REVOKED";
  sessionId?: string;
}

export interface IRealtimeBus {
  formatSse(eventData: SseEventData): string;
  publishConversationMessage(conversationId: string, message: ConversationMessageEvent["message"]): void;
  publishConversationRead(conversationId: string, payload: ConversationReadEvent): void;
  subscribeConversation(conversationId: string, listener: (event: SseEventData) => void): () => void;
  publishNotification(userId: string, payload: NotificationEvent): void;
  publishUnreadCount(userId: string, payload: UnreadCountEvent): void;
  publishUserConversationMessage(userId: string, payload: UserConversationMessageEvent): void;
  publishSessionRevocation(userId: string, payload: SessionRevokedEvent): void;
  subscribeUser(userId: string, listener: (event: SseEventData) => void): () => void;
  listenerCount(channel: string): number;
}

/**
 * Format an SSE payload string according to the W3C EventSource standard.
 */
export function formatSse({ event, data, id, retry }: SseEventData): string {
  let out = "";
  if (id) out += `id: ${id}\n`;
  if (event) out += `event: ${event}\n`;
  if (retry) out += `retry: ${retry}\n`;
  out += `data: ${JSON.stringify(data, (_, v) => (typeof v === "bigint" ? Number(v) : v))}\n\n`;
  return out;
}

/**
 * In-memory EventEmitter bus for local single-process development.
 */
export class LocalRealtimeBus implements IRealtimeBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
  }

  public formatSse(eventData: SseEventData): string {
    return formatSse(eventData);
  }

  public publishConversationMessage(conversationId: string, message: ConversationMessageEvent["message"]) {
    this.emitter.emit(`conv:${conversationId}`, {
      event: "message",
      data: message,
      id: message.id,
    });
  }

  public publishConversationRead(conversationId: string, payload: ConversationReadEvent) {
    this.emitter.emit(`conv:${conversationId}`, {
      event: "read",
      data: payload,
      id: `read-${payload.conversationId}-${payload.userId}-${Date.now()}`,
    });
  }

  public subscribeConversation(
    conversationId: string,
    listener: (event: SseEventData) => void
  ): () => void {
    const channel = `conv:${conversationId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  public publishNotification(userId: string, payload: NotificationEvent) {
    this.emitter.emit(`user:${userId}`, {
      event: "notification",
      data: payload,
      id: payload.notification.id,
    });
  }

  public publishUnreadCount(userId: string, payload: UnreadCountEvent) {
    this.emitter.emit(`user:${userId}`, {
      event: "unread_count",
      data: payload,
      id: `unread-${payload.type}-${Date.now()}`,
    });
  }

  public publishUserConversationMessage(userId: string, payload: UserConversationMessageEvent) {
    this.emitter.emit(`user:${userId}`, {
      event: "conversation_message",
      data: payload,
      id: payload.message.id,
    });
  }

  public publishSessionRevocation(userId: string, payload: SessionRevokedEvent) {
    this.emitter.emit(`user:${userId}`, {
      event: "session_revoked",
      data: payload,
      id: `revoke-${Date.now()}`,
    });
  }

  public subscribeUser(userId: string, listener: (event: SseEventData) => void): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  public listenerCount(channel: string): number {
    return this.emitter.listenerCount(channel);
  }
}

/**
 * Distributed Redis Pub/Sub adapter for production multi-instance SSE deployments.
 * Enables Instance A to publish and Instance B to deliver to connected SSE clients.
 */
export class RedisRealtimeBus implements IRealtimeBus {
  private publisher: Redis;
  private subscriber: Redis;
  private emitter: EventEmitter;
  private instanceId: string;
  private pubSubChannel: string;

  constructor(options?: {
    publisher?: Redis;
    subscriber?: Redis;
    pubSubChannel?: string;
  }) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
    this.instanceId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.pubSubChannel = options?.pubSubChannel || "crewn:sse:bus";

    const pub = options?.publisher || getRedisClient();
    const sub = options?.subscriber || getRedisSubscriber();

    if (!pub || !sub) {
      throw new Error("RedisRealtimeBus requires operational Redis publisher and subscriber clients.");
    }

    this.publisher = pub;
    this.subscriber = sub;

    this.setupSubscriber();
  }

  private setupSubscriber() {
    this.subscriber.subscribe(this.pubSubChannel, (err) => {
      if (err) {
        logger.error({
          category: "COMMUNICATION",
          message: "Failed to subscribe to Redis realtime channel",
          details: err.message,
        });
      }
    });

    this.subscriber.on("message", (channel, message) => {
      if (channel !== this.pubSubChannel) return;

      try {
        const payload = JSON.parse(message) as {
          originId: string;
          targetChannel: string;
          eventData: SseEventData;
        };

        // If message was published by this same instance, local emitter already fired
        if (payload.originId === this.instanceId) {
          return;
        }

        // Deliver to connected SSE clients on this instance
        this.emitter.emit(payload.targetChannel, payload.eventData);
      } catch (err) {
        logger.error({
          category: "COMMUNICATION",
          message: "Failed parsing Redis Pub/Sub realtime message",
          details: (err as Error).message,
        });
      }
    });
  }

  public formatSse(eventData: SseEventData): string {
    return formatSse(eventData);
  }

  private publish(targetChannel: string, eventData: SseEventData) {
    // 1. Immediately fire local emitter for connected clients on this instance
    this.emitter.emit(targetChannel, eventData);

    // 2. Publish to distributed Redis channel for other instances
    const packet = JSON.stringify({
      originId: this.instanceId,
      targetChannel,
      eventData,
    });

    this.publisher.publish(this.pubSubChannel, packet).catch((err) => {
      logger.error({
        category: "COMMUNICATION",
        message: "Failed to broadcast SSE event via Redis Pub/Sub",
        details: (err as Error).message,
      });
    });
  }

  public publishConversationMessage(conversationId: string, message: ConversationMessageEvent["message"]) {
    this.publish(`conv:${conversationId}`, {
      event: "message",
      data: message,
      id: message.id,
    });
  }

  public publishConversationRead(conversationId: string, payload: ConversationReadEvent) {
    this.publish(`conv:${conversationId}`, {
      event: "read",
      data: payload,
      id: `read-${payload.conversationId}-${payload.userId}-${Date.now()}`,
    });
  }

  public subscribeConversation(
    conversationId: string,
    listener: (event: SseEventData) => void
  ): () => void {
    const channel = `conv:${conversationId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  public publishNotification(userId: string, payload: NotificationEvent) {
    this.publish(`user:${userId}`, {
      event: "notification",
      data: payload,
      id: payload.notification.id,
    });
  }

  public publishUnreadCount(userId: string, payload: UnreadCountEvent) {
    this.publish(`user:${userId}`, {
      event: "unread_count",
      data: payload,
      id: `unread-${payload.type}-${Date.now()}`,
    });
  }

  public publishUserConversationMessage(userId: string, payload: UserConversationMessageEvent) {
    this.publish(`user:${userId}`, {
      event: "conversation_message",
      data: payload,
      id: payload.message.id,
    });
  }

  public publishSessionRevocation(userId: string, payload: SessionRevokedEvent) {
    this.publish(`user:${userId}`, {
      event: "session_revoked",
      data: payload,
      id: `revoke-${Date.now()}`,
    });
  }

  public subscribeUser(userId: string, listener: (event: SseEventData) => void): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  public listenerCount(channel: string): number {
    return this.emitter.listenerCount(channel);
  }
}

/**
 * Factory function to create or resolve the appropriate realtime bus.
 */
function createRealtimeBus(): IRealtimeBus {
  const isBuild =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build";
  const isProd = process.env.NODE_ENV === "production" && !isBuild;
  const redisUrl = process.env.REDIS_URL;

  if (isProd) {
    if (!redisUrl) {
      throw new Error(
        "Production multi-instance SSE requires REDIS_URL to be configured. Local EventEmitter is forbidden in production."
      );
    }
    return new RedisRealtimeBus();
  }

  if (redisUrl && !isBuild) {
    try {
      return new RedisRealtimeBus();
    } catch {
      return new LocalRealtimeBus();
    }
  }

  return new LocalRealtimeBus();
}

declare global {
  var __crewn_realtime_bus__: IRealtimeBus | undefined;
}

export const realtimeBus: IRealtimeBus =
  globalThis.__crewn_realtime_bus__ || createRealtimeBus();

if (process.env.NODE_ENV !== "production") {
  globalThis.__crewn_realtime_bus__ = realtimeBus;
}
