import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";
import Link from "next/link";

const FILTER_TAGS = [
  "All Disciplines",
  "Commercial Videography",
  "Product Photography",
  "DaVinci Colorists",
  "3D CGI & Houdini",
  "Brand Identity",
  "Commercial Copywriting",
];

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Talent Marketplace"
        subtitle="Discover verified creative professionals across commercial photography, film, and design"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
          <div className="flex-1 max-w-lg">
            <Input
              placeholder="Search by discipline, equipment, software, or creator name..."
              startIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {FILTER_TAGS.map((tag, idx) => (
              <Badge
                key={tag}
                variant={idx === 0 ? "default" : "outline"}
                size="md"
                className="cursor-pointer whitespace-nowrap"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Real architectural empty state */}
        <EmptyState
          icon={<Users className="h-7 w-7 text-muted-foreground" />}
          title="Talent Directory Initializing"
          description="In this phase, database schema and core services are established. Live search, multi-factor filtering, and creator matching will activate in Phase 2 with production PostgreSQL queries."
          action={
            <Link href="/register?role=freelancer">
              <Button variant="default" size="sm">
                Apply to Creator Directory
              </Button>
            </Link>
          }
          secondaryAction={
            <Link href="/business">
              <Button variant="outline" size="sm">
                Go to Business Workspace
              </Button>
            </Link>
          }
        />
      </main>
    </div>
  );
}
