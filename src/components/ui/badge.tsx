import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "pastel-pink"
    | "pastel-yellow"
    | "pastel-green"
    | "pastel-blue"
    | "success"
    | "warning";
  size?: "sm" | "md";
}

function Badge({
  className,
  variant = "default",
  size = "md",
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  const variantStyles = {
    default:
      "bg-primary text-primary-foreground border-transparent",
    secondary:
      "bg-secondary text-secondary-foreground border-border",
    outline:
      "text-foreground border-border bg-transparent",
    "pastel-pink":
      "bg-pastel-pink-subtle text-pink-700 dark:text-pink-300 border-pastel-pink-border",
    "pastel-yellow":
      "bg-pastel-yellow-subtle text-amber-800 dark:text-yellow-200 border-pastel-yellow-border",
    "pastel-green":
      "bg-pastel-green-subtle text-emerald-800 dark:text-emerald-300 border-pastel-green-border",
    "pastel-blue":
      "bg-pastel-blue-subtle text-blue-800 dark:text-blue-300 border-pastel-blue-border",
    success:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    warning:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-full border transition-colors select-none",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
