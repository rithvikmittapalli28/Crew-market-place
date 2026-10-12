"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Database,
  RefreshCw,
  Server,
  Zap,
  Shield,
  Loader2,
} from "lucide-react";

interface SystemHealthData {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  services: {
    database: {
      status: string;
      latencyMs: number;
      provider: string;
      error: string | null;
    };
    webhooks: {
      status: string;
      unprocessedCount: number;
      failedCount: number;
    };
    sessions: {
      activeSessions: number;
    };
    audit: {
      eventsLast24h: number;
    };
    environment: {
      nodeVersion: string;
      env: string;
    };
  };
}

export function AdminSystemClient() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system-health");
      if (!res.ok) throw new Error("Failed to load health metrics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Health fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const res = await fetch("/api/admin/system-health");
        if (!res.ok) throw new Error("Failed to load health metrics");
        const json = await res.json();
        if (active) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        console.error("Health fetch error:", err);
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hours}h ${mins}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-muted-foreground text-xs">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
        Probing system health...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-xs">
        Failed to obtain authoritative system telemetry.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-6 bg-card border border-border rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              data.status === "OPTIMAL" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600"
            }`}>
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">System Status: {data.status}</h2>
              <p className="text-xs text-muted-foreground">
                Process Uptime: <span className="font-mono text-foreground font-semibold">{formatUptime(data.uptimeSeconds)}</span> • Last check: {new Date(data.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="refresh-system-health-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Health Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Database */}
        <div className="p-5 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Database className="w-4 h-4 text-blue-500" />
              PostgreSQL Relational DB
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {data.services.database.status}
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground font-mono text-[11px]">
            <p>Provider: {data.services.database.provider}</p>
            <p>Query Latency: <span className="font-bold text-foreground">{data.services.database.latencyMs} ms</span></p>
          </div>
        </div>

        {/* Webhooks Queue */}
        <div className="p-5 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Zap className="w-4 h-4 text-amber-500" />
              Razorpay Webhooks
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              data.services.webhooks.failedCount === 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive"
            }`}>
              {data.services.webhooks.status}
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground font-mono text-[11px]">
            <p>Pending Processing: {data.services.webhooks.unprocessedCount}</p>
            <p>Failed Events: {data.services.webhooks.failedCount}</p>
          </div>
        </div>

        {/* Sessions & Auth */}
        <div className="p-5 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Shield className="w-4 h-4 text-purple-500" />
              Auth & Active Sessions
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400">
              OPERATIONAL
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground font-mono text-[11px]">
            <p>Active PostgreSQL Sessions: <span className="font-bold text-foreground">{data.services.sessions.activeSessions}</span></p>
            <p>Audit Events (24h): <span className="font-bold text-foreground">{data.services.audit.eventsLast24h}</span></p>
          </div>
        </div>

        {/* Runtime Environment */}
        <div className="p-5 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Server className="w-4 h-4 text-primary" />
              Node.js Runtime
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground">
              {data.services.environment.env}
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground font-mono text-[11px]">
            <p>Version: {data.services.environment.nodeVersion}</p>
            <p>Platform: {process.platform}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
