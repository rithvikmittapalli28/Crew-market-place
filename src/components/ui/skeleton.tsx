import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-muted/70",
        className
      )}
      {...props}
    />
  );
}

function LoadingSpinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
    />
  );
}

function FullPageLoading({ message = "Loading workspace..." }: { message?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <LoadingSpinner size="lg" className="text-foreground" />
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {message}
      </p>
    </div>
  );
}

export { Skeleton, LoadingSpinner, FullPageLoading };
