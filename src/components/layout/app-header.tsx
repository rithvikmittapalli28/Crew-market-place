"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Sparkles,
  Search,
  Briefcase,
  MessageSquare,
  Settings,
  ShieldAlert,
  ArrowLeft,
  LogOut,
  Wallet,
  FileText,
} from "lucide-react";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Filter routes based on user role
  const allowedRoutes = React.useMemo(() => {
    if (!user) {
      return [
        { name: "Business", href: "/business", icon: Building2 },
        { name: "Freelancer", href: "/freelancer", icon: Sparkles },
        { name: "Marketplace", href: "/marketplace", icon: Search },
        { name: "Projects", href: "/projects", icon: Briefcase },
        { name: "Messages", href: "/messages", icon: MessageSquare },
        { name: "Settings", href: "/settings", icon: Settings },
      ];
    }

    const routes = [];
    if (user.role === "BUSINESS" || user.role === "ADMIN") {
      routes.push(
        { name: "Business", href: "/business", icon: Building2 },
        { name: "Invoices", href: "/business/invoices", icon: FileText }
      );
    }
    if (user.role === "FREELANCER" || user.role === "ADMIN") {
      routes.push(
        { name: "Freelancer", href: "/freelancer", icon: Sparkles },
        { name: "Earnings", href: "/freelancer/earnings", icon: Wallet }
      );
    }
    routes.push(
      { name: "Marketplace", href: "/marketplace", icon: Search },
      { name: "Projects", href: "/projects", icon: Briefcase },
      { name: "Messages", href: "/messages", icon: MessageSquare },
      { name: "Settings", href: "/settings", icon: Settings }
    );
    if (user.role === "ADMIN") {
      routes.push({ name: "Admin", href: "/admin", icon: ShieldAlert });
    }
    return routes;
  }, [user]);

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background font-black text-xs">
                C
              </span>
              <span className="font-extrabold tracking-tight">crewn</span>
            </Link>

            <div className="hidden sm:block h-4 w-px bg-border" />

            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">{title}</h1>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground hidden md:block">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user && <NotificationBell />}
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-2.5 pl-2 border-l border-border">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-foreground leading-none">
                    {user.name || user.email}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">
                    {user.role}
                  </span>
                </div>

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background font-black text-xs uppercase">
                  {(user.name || user.email)[0]}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="h-8 px-2 text-muted-foreground hover:text-destructive text-xs gap-1 cursor-pointer"
                  title="Sign out of Crewn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" size="sm" className="text-xs">
                    Join Crewn
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Navigation Bar */}
        <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-border/40">
          {allowedRoutes.map((route) => {
            const Icon = route.icon;
            const isActive = pathname === route.href || pathname?.startsWith(route.href + "/");

            return (
              <Link
                key={route.name}
                href={route.href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{route.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
