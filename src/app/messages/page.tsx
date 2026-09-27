import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppHeader } from "@/components/layout/app-header";
import { MessagingClient } from "@/components/messages/messaging-client";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Communications Hub — Crewn",
  description: "Direct client-creator messaging and dedicated project team collaboration channels.",
};

export default async function MessagesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?from=/messages");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader
        title="Communications Hub"
        subtitle="Campaign discussion channels, deliverable feedback, and direct client-creator chats"
      />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="flex h-[calc(100vh-8.5rem)] items-center justify-center rounded-2xl border border-border bg-card/40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          }
        >
          <MessagingClient currentUserId={user.id} />
        </Suspense>
      </main>
    </div>
  );
}
