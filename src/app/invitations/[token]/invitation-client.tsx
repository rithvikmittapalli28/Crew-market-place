"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface Props {
  token: string;
  projectId: string;
  projectTitle: string;
}

export function InvitationActionButtons({ token, projectId, projectTitle }: Props) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/invitations/${token}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }
      setDone("accepted");
      // Redirect to the project workspace
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/invitations/${token}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to decline invitation");
        return;
      }
      setDone("declined");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeclining(false);
    }
  };

  if (done === "accepted") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle className="h-10 w-10 text-green-500" />
        <p className="text-sm font-bold text-foreground">You&apos;re in!</p>
        <p className="text-xs text-muted-foreground">
          You have joined <span className="font-semibold">{projectTitle}</span>. Redirecting to the
          project workspace…
        </p>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Invitation Declined</p>
        <p className="text-xs text-muted-foreground">
          You have declined this invitation. You can close this page.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push("/marketplace")}>
          Browse Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive text-center">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={handleDecline}
          disabled={accepting || declining}
          id="invitation-decline"
        >
          {declining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Decline
        </Button>
        <Button
          variant="default"
          className="flex-1 gap-1.5"
          onClick={handleAccept}
          disabled={accepting || declining}
          id="invitation-accept"
        >
          {accepting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Accept Invitation
        </Button>
      </div>
    </div>
  );
}
