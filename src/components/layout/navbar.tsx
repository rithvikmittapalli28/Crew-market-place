"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Menu, X, ArrowUpRight, Sparkles } from "lucide-react";

import { useAuth } from "@/context/auth-context";

const NAV_LINKS = [
  { name: "Explore Talent", href: "#featured-creators" },
  { name: "Categories", href: "#talent-categories" },
  { name: "How It Works", href: "#how-it-works" },
  { name: "Workspace", href: "#workspace-preview" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user } = useAuth();

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const dashboardHref =
    user?.role === "BUSINESS"
      ? "/business"
      : user?.role === "FREELANCER"
      ? "/freelancer"
      : user?.role === "ADMIN"
      ? "/admin"
      : "/business";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-200 border-b",
          isScrolled
            ? "border-border/80 bg-background/85 backdrop-blur-md shadow-xs py-3.5"
            : "border-transparent bg-background/40 backdrop-blur-xs py-5"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="group flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background font-black text-sm tracking-tighter transition-transform duration-200 group-hover:scale-105">
                C
              </span>
              <span className="tracking-tight font-extrabold text-lg">
                crewn<span className="text-pastel-pink font-serif">.</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />

            {user ? (
              <Link href={dashboardHref}>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold px-4 tracking-wide"
                >
                  <span>Open Workspace</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-sm font-medium">
                    Sign In
                  </Button>
                </Link>

                <Link href="/register">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 text-xs font-semibold px-4 tracking-wide uppercase"
                  >
                    <span>Get Started</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Right Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[60px] z-50 bg-background/95 backdrop-blur-xl md:hidden animate-in fade-in slide-in-from-top-4 duration-200 border-t border-border">
          <div className="flex flex-col justify-between h-[calc(100vh-60px)] px-6 py-8">
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Navigation
              </p>
              <div className="flex flex-col space-y-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between text-lg font-medium text-foreground py-2 border-b border-border/40"
                  >
                    <span>{link.name}</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2 mt-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-pastel-pink uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Two-Sided Platform</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Connect with vetted creative specialists or pitch for verified commercial projects.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-border">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full"
              >
                <Button variant="outline" size="lg" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full"
              >
                <Button variant="default" size="lg" className="w-full">
                  Join Crewn Platform
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
