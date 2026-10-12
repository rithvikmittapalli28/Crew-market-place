import React from "react";
import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authoritative admin check
  const admin = await requireAdminUser("/login");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-card/50 backdrop-blur-md flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-4 md:p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
                CREWN <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">ADMIN</span>
              </span>
              <p className="text-[10px] text-muted-foreground">Platform Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-x-auto md:overflow-y-auto py-2 md:py-4">
          <AdminNav />
        </div>

        {/* Admin Footer Badge */}
        <div className="p-4 border-t border-border mt-auto hidden md:flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{admin.name || "Admin"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{admin.email}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card/30 backdrop-blur px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit to Marketplace
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="h-4 w-[1px] bg-border" />
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              {admin.email}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
