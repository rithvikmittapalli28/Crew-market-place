"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Palette,
  Briefcase,
  FileSignature,
  CreditCard,
  Receipt,
  Scale,
  ShieldAlert,
  History,
  Activity,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Creators", href: "/admin/creators", icon: Palette },
  { label: "Projects", href: "/admin/projects", icon: Briefcase },
  { label: "Contracts", href: "/admin/contracts", icon: FileSignature },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Reconciliation", href: "/admin/finance/reconciliation", icon: Scale },
  { label: "Invoices", href: "/admin/invoices", icon: Receipt },
  { label: "Disputes", href: "/admin/disputes", icon: Scale },
  { label: "Moderation", href: "/admin/moderation", icon: ShieldAlert },
  { label: "Audit Log", href: "/admin/audit-log", icon: History },
  { label: "System Health", href: "/admin/system", icon: Activity },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex md:flex-col gap-1 px-3 py-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin"
          ? pathname === "/admin"
          : pathname.startsWith(item.href);

        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            id={`admin-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
