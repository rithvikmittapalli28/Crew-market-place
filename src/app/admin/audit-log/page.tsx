import React from "react";
import { AdminAuditLogClient } from "./audit-log-client";
import { History } from "lucide-react";

export default function AdminAuditLogPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Immutable Platform Audit Trail</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Chronological, tamper-evident record of all administrative, financial, dispute, and moderation events across Crewn.
        </p>
      </div>

      <AdminAuditLogClient />
    </div>
  );
}
