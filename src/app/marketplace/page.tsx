"use client";

import * as React from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Users,
} from "lucide-react";

interface CreatorCardData {
  id: string;
  publicSlug: string | null;
  name: string;
  avatarUrl: string | null;
  headline: string;
  location: string | null;
  yearsExperience: number;
  hourlyRate: number | null;
  startingPrice: number | null;
  isVerified: boolean;
  availability: {
    status: string;
    hoursPerWeek: number;
    nextAvailableDate?: string | null;
  } | null;
  topSkills: string[];
  servicesCount: number;
}

const CATEGORIES = [
  { label: "All Disciplines", slug: "" },
  { label: "Video & Film", slug: "video" },
  { label: "Photography", slug: "photography" },
  { label: "Editing & Color", slug: "editing" },
  { label: "3D & Motion", slug: "3d" },
  { label: "Design & Brand", slug: "design" },
  { label: "Copywriting", slug: "copywriting" },
];

export default function MarketplacePage() {
  const [creators, setCreators] = React.useState<CreatorCardData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [selectedSkill, setSelectedSkill] = React.useState("");
  const [selectedAvailability, setSelectedAvailability] = React.useState("");
  const [minPrice, setMinPrice] = React.useState("");
  const [maxPrice, setMaxPrice] = React.useState("");
  const [minExperience, setMinExperience] = React.useState("");
  const [locationQuery, setLocationQuery] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("newest");
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  const fetchCreators = React.useCallback(
    async (isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (selectedCategory) params.set("category", selectedCategory);
        if (selectedSkill) params.set("skill", selectedSkill);
        if (selectedAvailability) params.set("availability", selectedAvailability);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        if (minExperience) params.set("minExperience", minExperience);
        if (locationQuery) params.set("location", locationQuery);
        if (sortOrder) params.set("sort", sortOrder);
        if (isLoadMore && nextCursor) params.set("cursor", nextCursor);
        params.set("limit", "12");

        const res = await fetch(`/api/marketplace/creators?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load marketplace data");

        const data = await res.json();

        if (isLoadMore) {
          setCreators((prev) => [...prev, ...data.creators]);
        } else {
          setCreators(data.creators);
        }

        setTotalCount(data.pagination.totalCount);
        setNextCursor(data.pagination.nextCursor);
      } catch (err) {
        console.error("Marketplace fetch error:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      searchQuery,
      selectedCategory,
      selectedSkill,
      selectedAvailability,
      minPrice,
      maxPrice,
      minExperience,
      locationQuery,
      sortOrder,
      nextCursor,
    ]
  );

  // Debounced search / trigger on filter change
  React.useEffect(() => {
    const handler = setTimeout(() => {
      fetchCreators(false);
    }, 250);

    return () => clearTimeout(handler);
  }, [
    searchQuery,
    selectedCategory,
    selectedSkill,
    selectedAvailability,
    minPrice,
    maxPrice,
    minExperience,
    locationQuery,
    sortOrder,
    fetchCreators,
  ]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedSkill("");
    setSelectedAvailability("");
    setMinPrice("");
    setMaxPrice("");
    setMinExperience("");
    setLocationQuery("");
    setSortOrder("newest");
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(selectedCategory) ||
    Boolean(selectedSkill) ||
    Boolean(selectedAvailability) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    Boolean(minExperience) ||
    Boolean(locationQuery);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Creator Discovery Marketplace"
        subtitle="Explore verified creative directors, videographers, editors, and photographers"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Search & Category Navigation */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                placeholder="Search creators by discipline, skills, equipment, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startIcon={<Search className="h-4 w-4 text-muted-foreground" />}
                className="h-11 bg-card text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="md:hidden flex items-center gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </Button>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-11 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="newest">Sort: Newest Profiles</option>
                <option value="recent">Sort: Recently Active</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="experience">Most Experienced</option>
              </select>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content: Sidebar Filters + Creator Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Desktop Filter Sidebar */}
          <aside
            className={`space-y-6 md:block ${
              showMobileFilters ? "block" : "hidden"
            } col-span-1 bg-card p-5 rounded-xl border border-border h-fit sticky top-24`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 font-medium text-sm">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Filters
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Availability Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Availability
              </label>
              <select
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Any Availability</option>
                <option value="AVAILABLE">Available Now</option>
                <option value="PARTIALLY_AVAILABLE">Partially Available</option>
                <option value="BUSY">Busy / Booking Ahead</option>
              </select>
            </div>

            {/* Experience Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Experience
              </label>
              <select
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Any Experience Level</option>
                <option value="1">1+ years</option>
                <option value="3">3+ years</option>
                <option value="5">5+ years</option>
                <option value="8">8+ years</option>
              </select>
            </div>

            {/* Hourly Rate Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hourly Rate (₹)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-9 text-xs"
                />
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Location
              </label>
              <Input
                placeholder="City, State, or Country"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                startIcon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                className="h-9 text-xs"
              />
            </div>
          </aside>

          {/* Creators Grid */}
          <section className="col-span-1 md:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {totalCount}
                </span>{" "}
                verified creative professional{totalCount === 1 ? "" : "s"}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all filters
                </Button>
              )}
            </div>

            {/* Loading State */}
            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-5 space-y-4 border border-border">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                    <Skeleton className="h-10 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-7 w-20 rounded" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : creators.length === 0 ? (
              /* Empty Results State */
              <EmptyState
                icon={<Users className="h-8 w-8 text-muted-foreground" />}
                title="No creators found"
                description={
                  hasActiveFilters
                    ? "No creators match your active filter criteria. Try adjusting or clearing your filters."
                    : "No verified creators are currently visible in the public directory."
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="default" size="sm" onClick={handleResetFilters}>
                      Reset Filters
                    </Button>
                  ) : (
                    <Link href="/register?role=freelancer">
                      <Button variant="default" size="sm">
                        Become a Crewn Creator
                      </Button>
                    </Link>
                  )
                }
              />
            ) : (
              /* Cards Grid */
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {creators.map((creator) => {
                  const slugOrId = creator.publicSlug || creator.id;
                  const initials = creator.name
                    ? creator.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "CR";

                  const isAvailable =
                    creator.availability?.status === "AVAILABLE";
                  const isPartial =
                    creator.availability?.status === "PARTIALLY_AVAILABLE";

                  return (
                    <Card
                      key={creator.id}
                      className="group relative flex flex-col justify-between overflow-hidden border border-border bg-card p-5 hover:border-primary/50 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="space-y-3.5">
                        {/* Header: Avatar, Name, Verified */}
                        <div className="flex items-start gap-3.5">
                          <Avatar className="h-12 w-12 border border-border">
                            {creator.avatarUrl && (
                              <AvatarImage
                                src={creator.avatarUrl}
                                alt={creator.name}
                              />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {creator.name}
                              </h3>
                              {creator.isVerified && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {creator.headline || "Creative Specialist"}
                            </p>
                          </div>
                        </div>

                        {/* Availability & Location metadata */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
                          {creator.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[130px]">
                                {creator.location}
                              </span>
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {creator.yearsExperience}y exp
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              isAvailable
                                ? "bg-emerald-500/10 text-emerald-500"
                                : isPartial
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isAvailable
                                  ? "bg-emerald-500"
                                  : isPartial
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground"
                              }`}
                            />
                            {isAvailable
                              ? "Available"
                              : isPartial
                              ? "Limited"
                              : "Busy"}
                          </span>
                        </div>

                        {/* Skills Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {creator.topSkills.slice(0, 3).map((skill) => (
                            <Badge
                              key={skill}
                              variant="secondary"
                              size="sm"
                              className="text-[11px] px-2 py-0.5 bg-muted/70"
                            >
                              {skill}
                            </Badge>
                          ))}
                          {creator.topSkills.length > 3 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{creator.topSkills.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Pricing & Action */}
                      <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">
                            Rate
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {creator.hourlyRate
                              ? `₹${creator.hourlyRate.toLocaleString()}/hr`
                              : creator.startingPrice
                              ? `Starts ₹${creator.startingPrice.toLocaleString()}`
                              : "Inquire"}
                          </p>
                        </div>

                        <Link href={`/creators/${slugOrId}`}>
                          <Button
                            variant="default"
                            size="sm"
                            className="text-xs group-hover:bg-primary gap-1"
                          >
                            View Profile
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pagination / Load More */}
            {nextCursor && !loading && (
              <div className="pt-6 text-center">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => fetchCreators(true)}
                  disabled={loadingMore}
                  className="min-w-[180px]"
                >
                  {loadingMore ? "Loading more..." : "Load More Creators"}
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
