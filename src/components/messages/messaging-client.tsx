"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MessageSquare,
  Users,
  Search,
  Send,
  Paperclip,
  CheckCheck,
  Building2,
  Sparkles,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  X,
  Briefcase,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface ConversationListItem {
  id: string;
  type: "DIRECT" | "PROJECT" | "TEAM";
  title: string;
  avatarUrl: string | null;
  otherParticipant: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
    freelancerProfile?: { headline?: string | null; publicSlug?: string | null } | null;
  } | null;
  membersCount: number;
  latestMessage: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    hasAttachments: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

interface MessageAttachment {
  id: string;
  file: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storageKey: string;
    isPublic: boolean;
  };
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
  attachments: MessageAttachment[];
}

export function MessagingClient({ currentUserId }: { currentUserId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [conversations, setConversations] = React.useState<ConversationListItem[]>([]);
  const [selectedConvId, setSelectedConvId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<MessageItem[]>([]);
  const [loadingConvList, setLoadingConvList] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [uploadingFile, setUploadingFile] = React.useState(false);

  const [inputText, setInputText] = React.useState("");
  const [attachedFiles, setAttachedFiles] = React.useState<
    Array<{ id: string; name: string; mimeType: string; size: number }>
  >([]);
  const [filterType, setFilterType] = React.useState<"ALL" | "DIRECT" | "PROJECT">("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 1. Fetch conversations list
  const fetchConversations = React.useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConvList(false);
    }
  }, []);

  // 2. Initial load and auto-resolution from query params
  React.useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok && isMounted) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        if (isMounted) setLoadingConvList(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    const directUser = searchParams.get("user");
    const projectParam = searchParams.get("project");
    const convParam = searchParams.get("c");

    if (convParam) {
      const timer = setTimeout(() => {
        setSelectedConvId((prev) => (prev === convParam ? prev : convParam));
      }, 0);
      return () => clearTimeout(timer);
    }

    if (directUser && directUser !== currentUserId) {
      // Auto-create or open direct chat
      (async () => {
        try {
          const res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipientUserId: directUser }),
          });
          if (res.ok) {
            const data = await res.json();
            setSelectedConvId(data.conversation.id);
            fetchConversations();
          }
        } catch (e) {
          console.error("Direct chat init error:", e);
        }
      })();
    } else if (projectParam) {
      // Auto-open project channel
      (async () => {
        try {
          const res = await fetch(`/api/projects/${projectParam}/channel`, { method: "POST" });
          if (res.ok) {
            const data = await res.json();
            setSelectedConvId(data.conversationId);
            fetchConversations();
          }
        } catch (e) {
          console.error("Project channel init error:", e);
        }
      })();
    }
  }, [searchParams, currentUserId, fetchConversations]);

  // 3. Fetch active conversation messages and mark as read
  const fetchMessages = React.useCallback(
    async (convId: string, background = false) => {
      if (!background) setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations/${convId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);

          // Clear unread count locally for this conversation
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (!background) setLoadingMessages(false);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!selectedConvId) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchMessages(selectedConvId);
    }, 0);

    // Poll for new messages every 3 seconds while active
    const pollInterval = setInterval(() => {
      void fetchMessages(selectedConvId, true);
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, [selectedConvId, fetchMessages]);

  // Auto-scroll to bottom of message thread
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Send Message Handler
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConvId) return;

    const trimmed = inputText.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    try {
      setSending(true);
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          attachmentFileIds: attachedFiles.map((f) => f.id),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setInputText("");
      setAttachedFiles([]);

      // Update latest message in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConvId
            ? {
                ...c,
                latestMessage: {
                  id: data.message.id,
                  content: data.message.content,
                  senderId: data.message.senderId,
                  senderName: data.message.sender.name || data.message.sender.email,
                  createdAt: data.message.createdAt,
                  hasAttachments: (data.message.attachments || []).length > 0,
                },
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (err) {
      toast.error(
        "Message Error",
        err instanceof Error ? err.message : "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  };

  // 5. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File Too Large", "Maximum supported file size is 20MB.");
      return;
    }

    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "COMMUNICATION");
      formData.append("isPublic", "false");

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload attachment");
      }

      const data = await res.json();
      setAttachedFiles((prev) => [
        ...prev,
        {
          id: data.file.id,
          name: data.file.fileName || file.name,
          mimeType: data.file.mimeType || file.type,
          size: data.file.fileSize || file.size,
        },
      ]);
      toast.success("Attached", `${file.name} attached.`);
    } catch (err) {
      toast.error(
        "Upload Failed",
        err instanceof Error ? err.message : "Failed to upload file."
      );
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Selected conversation meta
  const activeConversation = conversations.find((c) => c.id === selectedConvId);

  // Filtered conversations
  const filteredConversations = conversations.filter((c) => {
    if (filterType === "DIRECT" && c.type !== "DIRECT") return false;
    if (filterType === "PROJECT" && c.type !== "PROJECT") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchSnippet = c.latestMessage?.content?.toLowerCase().includes(q);
      return matchTitle || matchSnippet;
    }
    return true;
  });

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-2xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* ----------------- LEFT SIDEBAR: CONVERSATION LIST ----------------- */}
      <div className="w-80 sm:w-96 border-r border-border/80 flex flex-col bg-card/80 shrink-0">
        {/* Header & Search */}
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>Channels & Chats</span>
            </h2>
            <Badge variant="outline" size="sm" className="text-[10px]">
              {conversations.length} total
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/60"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 pt-1">
            {(["ALL", "DIRECT", "PROJECT"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer",
                  filterType === type
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {type === "ALL" ? "All" : type === "DIRECT" ? "Direct" : "Projects"}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/30 scrollbar-thin">
          {loadingConvList ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-12 text-center px-4 text-muted-foreground space-y-2">
              <MessageSquare className="h-7 w-7 mx-auto text-muted-foreground/40" />
              <p className="text-xs font-semibold">No conversations found</p>
              <p className="text-[11px] text-muted-foreground/80">
                Start a direct chat from the Creator Marketplace or open a Project Channel.
              </p>
              <Link href="/marketplace" className="inline-block mt-2">
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <Users className="h-3 w-3" />
                  Explore Marketplace
                </Button>
              </Link>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = c.id === selectedConvId;
              const isProject = c.type === "PROJECT";

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedConvId(c.id);
                    router.push(`/messages?c=${c.id}`);
                  }}
                  className={cn(
                    "flex items-start gap-3 p-3.5 transition-all text-left cursor-pointer relative",
                    isSelected
                      ? "bg-primary/10 border-l-3 border-l-primary"
                      : "hover:bg-muted/40"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0 border border-border/70 shadow-xs">
                    {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.title} />}
                    <AvatarFallback
                      className={cn(
                        "text-xs font-bold",
                        isProject
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {isProject ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        c.title.slice(0, 2).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={cn(
                          "text-xs truncate",
                          c.unreadCount > 0 ? "font-bold text-foreground" : "font-semibold text-foreground/90"
                        )}
                      >
                        {c.title}
                      </p>
                      {c.latestMessage && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatMessageTime(c.latestMessage.createdAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isProject ? (
                        <span className="rounded bg-blue-500/10 px-1 py-0.2 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          Project Team
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {c.otherParticipant?.freelancerProfile?.headline || c.otherParticipant?.role || "Direct"}
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "text-[11px] truncate mt-1 leading-snug",
                        c.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {c.latestMessage ? (
                        <>
                          <span className="text-muted-foreground/80 font-medium">
                            {c.latestMessage.senderId === currentUserId ? "You: " : `${c.latestMessage.senderName}: `}
                          </span>
                          {c.latestMessage.content || "Attached files"}
                        </>
                      ) : (
                        <span className="italic text-muted-foreground/60">No messages yet</span>
                      )}
                    </p>
                  </div>

                  {c.unreadCount > 0 && (
                    <span className="absolute right-3 bottom-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------- RIGHT PANE: ACTIVE CHAT ----------------- */}
      <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
        {selectedConvId && activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-border/80 px-6 flex items-center justify-between bg-card/60 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-border shadow-xs">
                  {activeConversation.avatarUrl && (
                    <AvatarImage src={activeConversation.avatarUrl} alt={activeConversation.title} />
                  )}
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {activeConversation.type === "PROJECT" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      activeConversation.title.slice(0, 2).toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground tracking-tight">
                      {activeConversation.title}
                    </h3>
                    <Badge
                      variant={activeConversation.type === "PROJECT" ? "default" : "secondary"}
                      size="sm"
                      className="text-[9px] uppercase font-bold"
                    >
                      {activeConversation.type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {activeConversation.type === "PROJECT"
                      ? `${activeConversation.membersCount} campaign team collaborators`
                      : activeConversation.otherParticipant?.freelancerProfile?.headline ||
                        activeConversation.otherParticipant?.email ||
                        "Direct discussion"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeConversation.type === "PROJECT" && (
                  <Link href={`/projects`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      <Briefcase className="h-3 w-3" />
                      <span>Projects</span>
                    </Button>
                  </Link>
                )}

                {activeConversation.type === "DIRECT" &&
                  activeConversation.otherParticipant?.freelancerProfile?.publicSlug && (
                    <Link
                      href={`/creators/${activeConversation.otherParticipant.freelancerProfile.publicSlug}`}
                      target="_blank"
                    >
                      <Button variant="outline" size="sm" className="text-xs gap-1.5">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span>View Portfolio</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Button>
                    </Link>
                  )}
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {loadingMessages ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs font-medium">Fetching conversation thread...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center max-w-sm mx-auto space-y-2 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <h4 className="text-xs font-semibold text-foreground">No messages yet</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Kickstart the campaign discussion. Share creative briefs, discuss deliverables, or
                    coordinate deadlines.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.senderId === currentUserId;

                  return (
                    <div
                      key={m.id}
                      className={cn("flex items-end gap-2.5", isMine ? "justify-end" : "justify-start")}
                    >
                      {!isMine && (
                        <Avatar className="h-7 w-7 border border-border shrink-0 shadow-xs mb-1">
                          {m.sender.avatarUrl && (
                            <AvatarImage src={m.sender.avatarUrl} alt={m.sender.name || ""} />
                          )}
                          <AvatarFallback className="text-[10px] font-bold bg-muted">
                            {(m.sender.name || m.sender.email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className={cn("max-w-md sm:max-w-lg space-y-1.5", isMine ? "items-end" : "items-start")}>
                        {!isMine && (
                          <span className="text-[10px] font-semibold text-muted-foreground px-1">
                            {m.sender.name || m.sender.email}
                          </span>
                        )}

                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs transition-all",
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-xs"
                              : "bg-card border border-border/80 text-foreground rounded-bl-xs"
                          )}
                        >
                          {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}

                          {/* File Attachments */}
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2 space-y-1.5 pt-1.5 border-t border-current/15">
                              {m.attachments.map((att) => {
                                const f = att.file;
                                const isImg = f.mimeType?.startsWith("image/");
                                const downloadUrl = `/api/files/${f.storageKey}`;

                                return (
                                  <div
                                    key={att.id}
                                    className={cn(
                                      "flex items-center gap-2 p-1.5 rounded-lg text-[11px]",
                                      isMine ? "bg-black/15 text-primary-foreground" : "bg-muted/60 text-foreground"
                                    )}
                                  >
                                    {isImg ? (
                                      <ImageIcon className="h-4 w-4 shrink-0" />
                                    ) : (
                                      <FileText className="h-4 w-4 shrink-0" />
                                    )}
                                    <span className="font-medium truncate flex-1">{f.fileName}</span>
                                    <span className="text-[10px] opacity-75 shrink-0">
                                      {(f.fileSize / 1024).toFixed(0)} KB
                                    </span>
                                    <a
                                      href={downloadUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline hover:opacity-100 opacity-80 ml-1 font-semibold"
                                    >
                                      View
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div
                          className={cn(
                            "flex items-center gap-1 text-[9px] text-muted-foreground px-1",
                            isMine ? "justify-end" : "justify-start"
                          )}
                        >
                          <span>{formatMessageTime(m.createdAt)}</span>
                          {isMine && <CheckCheck className="h-3 w-3 text-primary opacity-80" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attached Files Staging */}
            {attachedFiles.length > 0 && (
              <div className="px-6 py-2 bg-muted/30 border-t border-border/60 flex items-center gap-2 flex-wrap">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1 text-[11px]"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium max-w-xs truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Message Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-border/80 bg-card/60 backdrop-blur-sm shrink-0 flex items-end gap-2.5"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.zip,.txt"
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="h-10 w-10 p-0 rounded-xl text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                title="Attach file or brief"
              >
                {uploadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>

              <div className="flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-10 max-h-32"
                />
              </div>

              <Button
                type="submit"
                disabled={sending || (!inputText.trim() && attachedFiles.length === 0)}
                size="sm"
                className="h-10 px-4 rounded-xl gap-1.5 cursor-pointer font-semibold text-xs shrink-0"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send</span>
              </Button>
            </form>
          </>
        ) : (
          /* Empty Chat State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-bold text-foreground">Select a conversation</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a direct conversation or project channel from the sidebar to view campaign notes,
                give creative feedback, and collaborate in real-time.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Link href="/marketplace">
                <Button variant="default" size="sm" className="text-xs gap-1.5 cursor-pointer">
                  <Users className="h-3.5 w-3.5" />
                  <span>Find Creators to Message</span>
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="outline" size="sm" className="text-xs gap-1.5 cursor-pointer">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>View Projects</span>
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
