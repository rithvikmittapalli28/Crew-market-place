import React from "react";
import { AdminUsersClient } from "./users-client";
import { Users } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Inspect user accounts, manage roles, audit associated project activity, and enforce suspensions.
        </p>
      </div>

      <AdminUsersClient />
    </div>
  );
}
