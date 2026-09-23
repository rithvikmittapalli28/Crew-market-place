import { PLATFORM_STATS } from "@/lib/mock-data/landing-data";
import { Badge } from "@/components/ui/badge";

export function StatsSection() {
  return (
    <section className="border-y border-border bg-card/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_STATS.map((stat) => (
            <div
              key={stat.id}
              className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 shadow-xs transition-all duration-200 hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
                  {stat.value}
                </span>
                <Badge variant={stat.accentVariant} size="sm">
                  Active
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight">
                  {stat.label}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {stat.subtext}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
