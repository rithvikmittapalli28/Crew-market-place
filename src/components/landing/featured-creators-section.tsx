import Link from "next/link";
import { FEATURED_CREATORS } from "@/lib/mock-data/landing-data";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, MapPin, CheckCircle2, ArrowUpRight } from "lucide-react";

export function FeaturedCreatorsSection() {
  return (
    <section id="featured-creators" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-pastel-green" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vetted Network
              </p>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Featured creative talent<span className="text-pastel-green font-serif">.</span>
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              Explore profiles of proven directors, editors, designers, and visualists ready to take on milestone engagements.
            </p>
          </div>

          <Link href="/marketplace">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer border-b border-border pb-0.5">
              Explore All 14,800+ Creators
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        {/* Creator Cards Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURED_CREATORS.map((creator) => {
            const initials = creator.name
              .split(" ")
              .map((n) => n[0])
              .join("");

            return (
              <div
                key={creator.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-md"
              >
                <div>
                  {/* Top Creator Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar size="lg" status="online">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-bold text-foreground">
                            {creator.name}
                          </h3>
                          {creator.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {creator.role}
                        </p>
                      </div>
                    </div>

                    <Badge variant={creator.accentColor} size="sm">
                      {creator.hourlyRate}
                    </Badge>
                  </div>

                  {/* Rating and Location */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1 text-amber-500 font-semibold">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span>{creator.rating}</span>
                      <span className="text-muted-foreground font-normal">
                        ({creator.reviewsCount})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{creator.location}</span>
                    </div>
                  </div>

                  {/* Featured Project Showcase Pill */}
                  <div className="rounded-xl bg-secondary/50 p-3 text-xs mb-4 border border-border/40">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Featured Milestone
                    </span>
                    <p className="font-medium text-foreground line-clamp-1">
                      {creator.featuredWorkTitle}
                    </p>
                  </div>

                  {/* Skill Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {creator.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Past Clients & Direct Action */}
                <div className="border-t border-border/50 pt-4 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Trusted by
                      </p>
                      <p className="text-xs font-medium text-foreground/80 mt-0.5">
                        {creator.pastClients.join(", ")}
                      </p>
                    </div>

                    <Link href={`/marketplace?q=${encodeURIComponent(creator.name)}`}>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors">
                        View Profile
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
