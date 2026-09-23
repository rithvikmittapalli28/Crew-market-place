import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users } from "lucide-react";
import Link from "next/link";

export default function MessagesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Direct Communications"
        subtitle="Campaign discussion channels, deliverable feedback, and direct client-creator chats"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState
          icon={<MessageSquare className="h-7 w-7 text-muted-foreground" />}
          title="No open conversations"
          description="In this foundation phase, messaging is intentionally un-mocked. Real-time project chats and milestone feedback threads will activate upon campaign initiation in Phase 2."
          action={
            <Link href="/marketplace">
              <Button variant="default" size="sm" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>Find Creators to Message</span>
              </Button>
            </Link>
          }
        />
      </main>
    </div>
  );
}
