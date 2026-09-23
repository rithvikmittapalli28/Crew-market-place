import * as React from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 text-center sm:p-12",
        className
      )}
      {...props}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/80 text-muted-foreground mb-4 border border-border/40">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground leading-relaxed mb-6">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
