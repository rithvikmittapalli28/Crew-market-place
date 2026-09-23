"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  reset?: () => void;
  actionText?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred while processing this view. Please try again or contact support if the issue persists.",
  reset,
  actionText = "Try Again",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center sm:p-12",
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground leading-relaxed mb-6">
        {message}
      </p>
      {reset && (
        <Button
          onClick={reset}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {actionText}
        </Button>
      )}
    </div>
  );
}
