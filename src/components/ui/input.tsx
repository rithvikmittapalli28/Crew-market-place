import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helperText, startIcon, endIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-muted-foreground">
              {startIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              "flex h-11 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-150 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              startIcon && "pl-10",
              endIcon && "pr-10",
              error && "border-destructive focus:border-destructive focus:ring-destructive",
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute right-3.5 flex items-center text-muted-foreground">
              {endIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
