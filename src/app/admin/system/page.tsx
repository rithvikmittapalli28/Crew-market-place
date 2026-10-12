import React from "react";
import { AdminSystemClient } from "./system-client";
import { Activity } from "lucide-react";

export default function AdminSystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">System Health & Infrastructure</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Monitor database query performance, webhook event reliability, active session states, and runtime health.
        </p>
      </div>

      <AdminSystemClient />
    </div>
  );
}
