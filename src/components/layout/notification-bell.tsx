"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCircle2,
  DollarSign,
  FileCheck,
  ListTodo,
  MessageSquare,
  Sparkles,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [sseConnected, setSseConnected] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const backoffRef = React.useRef<number>(1000);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, []);

  // 1. Real-time Server-Sent Events (SSE) listener with exponential backoff
  React.useEffect(() => {
    let eventSource: EventSource | null = null;
    let isDisposed = false;

    function connectSse() {
      if (isDisposed) return;

      try {
        eventSource = new EventSource("/api/notifications/events");

        eventSource.onopen = () => {
          setSseConnected(true);
          backoffRef.current = 1000; // Reset backoff upon successful connection
        };

        eventSource.addEventListener("connected", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (typeof data.unreadCount === "number") {
              setUnreadCount(data.unreadCount);
            }
          } catch (err) {
            console.error("Error parsing connected event:", err);
          }
        });

        eventSource.addEventListener("notification", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.notification) {
              setNotifications((prev) => {
                // Deduplicate by notification ID
                if (prev.some((n) => n.id === data.notification.id)) {
                  return prev;
                }
                return [data.notification, ...prev];
              });
            }
            if (typeof data.unreadCount === "number") {
              setUnreadCount(data.unreadCount);
            }
          } catch (err) {
            console.error("Error parsing notification SSE event:", err);
          }
        });

        eventSource.addEventListener("unread_count", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "NOTIFICATIONS" && typeof data.unreadCount === "number") {
              setUnreadCount(data.unreadCount);
            }
          } catch (err) {
            console.error("Error parsing unread_count SSE event:", err);
          }
        });

        eventSource.addEventListener("session_revoked", () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          setSseConnected(false);
        });

        eventSource.onerror = () => {
          setSseConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          if (!isDisposed) {
            // Reconnect with exponential backoff (capped at 10s)
            const nextDelay = Math.min(backoffRef.current * 1.5, 10000);
            backoffRef.current = nextDelay;
            reconnectTimeoutRef.current = setTimeout(connectSse, nextDelay);
          }
        };
      } catch (err) {
        setSseConnected(false);
        console.error("Failed to initialize SSE EventSource:", err);
      }
    }

    // Initial fetch to load notification list deferred to prevent synchronous cascading render
    const initTimer = setTimeout(() => {
      if (!isDisposed) {
        void fetchNotifications();
      }
    }, 0);

    // Connect to SSE stream
    connectSse();

    return () => {
      isDisposed = true;
      clearTimeout(initTimer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSource) eventSource.close();
    };
  }, [fetchNotifications]);

  // 2. Graceful polling fallback: only runs if SSE is not actively connected
  React.useEffect(() => {
    if (sseConnected) return;

    const interval = setInterval(() => {
      void fetchNotifications();
    }, 20000);

    return () => clearInterval(interval);
  }, [sseConnected, fetchNotifications]);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Mark all read error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "PAYMENT":
        return <DollarSign className="h-4 w-4 text-emerald-500" />;
      case "DELIVERABLE":
        return <FileCheck className="h-4 w-4 text-blue-500" />;
      case "TASK":
        return <ListTodo className="h-4 w-4 text-amber-500" />;
      case "MESSAGE":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "MILESTONE":
        return <CheckCircle2 className="h-4 w-4 text-indigo-500" />;
      default:
        return <Sparkles className="h-4 w-4 text-primary" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-75">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur-md z-50 overflow-hidden animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground tracking-tight">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.2">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-8 text-center px-4">
                <Bell className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No notifications yet</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Milestone updates, payments, and team chats will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const Content = (
                  <div
                    className={cn(
                      "flex items-start gap-3 p-3 text-left transition-colors relative hover:bg-muted/40 cursor-pointer",
                      !item.isRead ? "bg-primary/5" : ""
                    )}
                    onClick={() => {
                      if (!item.isRead) {
                        fetch(`/api/notifications/${item.id}/read`, { method: "PATCH" });
                      }
                      setIsOpen(false);
                    }}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background border border-border/80 shadow-xs">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("text-xs leading-snug truncate", !item.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground/70 shrink-0">
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {item.body}
                      </p>
                    </div>

                    {!item.isRead && (
                      <span className="absolute right-2.5 top-3.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                );

                return item.linkUrl ? (
                  <Link key={item.id} href={item.linkUrl} className="block">
                    {Content}
                  </Link>
                ) : (
                  <div key={item.id}>{Content}</div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/60 bg-muted/10 px-4 py-2 text-center">
            <Link
              href="/messages"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Open Direct Messages & Team Channels
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
