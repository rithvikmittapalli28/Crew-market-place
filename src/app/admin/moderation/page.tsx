import React from "react";
import { AdminModerationClient } from "./moderation-client";
import { ShieldAlert } from "lucide-react";

export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Moderation & Safety</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Review community reports, triage abusive or fraudulent activity, issue official warnings, and execute account suspensions.
        </p>
      </div>

      <AdminModerationClient />
    </div>
  );
}
