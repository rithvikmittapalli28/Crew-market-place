"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Loader2,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  projectId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  metadataJson: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor?: { id: string; name: string | null; email: string; role: string } | null;
}

export function AdminAuditLogClient() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("ALL");
  const [actionSearch, setActionSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (entityType !== "ALL") params.append("entityType", entityType);
      if (actionSearch.trim()) params.append("action", actionSearch.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, actionSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchLogs();
    }, 250);
    return () => clearTimeout(timeout);
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-2xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            id="audit-log-action-search"
            value={actionSearch}
            onChange={(e) => {
              setActionSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search action name (e.g. SUSPEND, RESOLVE)..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/60">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              id="audit-log-entity-filter"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Entity Types</option>
              <option value="ADMIN_ACTION">ADMIN ACTION</option>
              <option value="USER">USER</option>
              <option value="PROJECT">PROJECT</option>
              <option value="CONTRACT">CONTRACT</option>
              <option value="DISPUTE">DISPUTE</option>
              <option value="MODERATION_REPORT">MODERATION REPORT</option>
              <option value="MILESTONE">MILESTONE</option>
              <option value="DELIVERABLE">DELIVERABLE</option>
              <option value="PAYMENT">PAYMENT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Action Event</th>
                <th className="py-3.5 px-4">Entity Type / ID</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Metadata Payload</th>
                <th className="py-3.5 px-4 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground font-sans">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading platform audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground font-sans">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        log.action.includes("ADMIN")
                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          : log.action.includes("RESOLVE") || log.action.includes("PAID")
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : log.action.includes("SUSPEND")
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-foreground"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="font-semibold text-foreground">{log.entityType}</span>
                      <p className="text-[10px] text-muted-foreground font-mono">#{log.entityId.slice(0, 10)}</p>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-sans">
                      <p className="text-foreground font-medium text-xs">{log.actor?.name || log.actor?.email || "System Service"}</p>
                      {log.actor?.role && <span className="text-[10px] text-muted-foreground">({log.actor.role})</span>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate text-[10px]">
                      {log.metadataJson || "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground font-mono text-[10px]">
                      {log.ipAddress || "127.0.0.1"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-medium bg-card border border-border rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-xs font-medium bg-card border border-border rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
