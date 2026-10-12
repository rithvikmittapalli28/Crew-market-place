import React from "react";
import { AdminDisputesClient } from "./disputes-client";
import { Scale } from "lucide-react";

export default function AdminDisputesPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dispute Resolution & Triage</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Mediate project disputes, inspect submitted evidence, post official directives, and execute authoritative escrow settlements.
        </p>
      </div>

      <AdminDisputesClient />
    </div>
  );
}
