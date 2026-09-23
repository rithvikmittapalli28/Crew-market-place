import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "pastel-pink"
    | "pastel-yellow"
    | "pastel-green"
    | "pastel-blue";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]";

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
      icon: "h-10 w-10 p-0",
    };

    const variantStyles = {
      default:
        "bg-primary text-primary-foreground hover:opacity-90 shadow-sm border border-transparent",
      secondary:
        "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      outline:
        "bg-transparent border border-border text-foreground hover:bg-muted/60",
      ghost:
        "bg-transparent text-foreground hover:bg-muted hover:text-foreground",
      destructive:
        "bg-destructive text-destructive-foreground hover:opacity-90",
      "pastel-pink":
        "bg-pastel-pink-subtle text-pink-700 dark:text-pink-300 border border-pastel-pink-border hover:bg-pink-100 dark:hover:bg-pink-950/40",
      "pastel-yellow":
        "bg-pastel-yellow-subtle text-amber-800 dark:text-yellow-200 border border-pastel-yellow-border hover:bg-yellow-100 dark:hover:bg-yellow-950/40",
      "pastel-green":
        "bg-pastel-green-subtle text-emerald-800 dark:text-emerald-300 border border-pastel-green-border hover:bg-emerald-100 dark:hover:bg-emerald-950/40",
      "pastel-blue":
        "bg-pastel-blue-subtle text-blue-800 dark:text-blue-300 border border-pastel-blue-border hover:bg-blue-100 dark:hover:bg-blue-950/40",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
