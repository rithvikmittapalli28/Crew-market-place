import Link from "next/link";
import { TALENT_CATEGORIES } from "@/lib/mock-data/landing-data";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Video,
  Film,
  Sparkles,
  Palette,
  PenTool,
  Share2,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

export function CategoriesSection() {
  const iconMap: Record<string, React.ReactNode> = {
    Camera: <Camera className="h-5 w-5" />,
    Video: <Video className="h-5 w-5" />,
    Film: <Film className="h-5 w-5" />,
    Sparkles: <Sparkles className="h-5 w-5" />,
    Palette: <Palette className="h-5 w-5" />,
    PenTool: <PenTool className="h-5 w-5" />,
    Share2: <Share2 className="h-5 w-5" />,
    TrendingUp: <TrendingUp className="h-5 w-5" />,
  };

  return (
    <section id="talent-categories" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-6 rounded-full bg-pastel-pink" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Disciplines & Specialties
              </p>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Curated creative disciplines<span className="text-pastel-pink font-serif">.</span>
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
              Every talent profile on Crewn is verified for commercial acumen, portfolio depth, and client responsiveness.
            </p>
          </div>

          <Link href="/register?role=business">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer border-b border-border pb-0.5">
              Browse All Verified Disciplines
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TALENT_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground group-hover:bg-foreground group-hover:text-background transition-colors duration-200">
                    {iconMap[cat.iconName]}
                  </div>
                  <Badge variant={cat.accentColor} size="sm">
                    Verified
                  </Badge>
                </div>

                <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-foreground">
                  {cat.name}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {cat.description}
                </p>
              </div>

              {/* Sub-discipline Pills */}
              <div className="border-t border-border/50 pt-4 mt-2">
                <div className="flex flex-wrap gap-1.5">
                  {cat.disciplines.map((d) => (
                    <span
                      key={d}
                      className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
