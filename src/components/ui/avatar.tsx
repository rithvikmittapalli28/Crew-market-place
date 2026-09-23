"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarContextValue {
  size: "sm" | "md" | "lg" | "xl";
}

const AvatarContext = React.createContext<AvatarContextValue>({ size: "md" });

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "busy" | "offline";
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", status, children, ...props }, ref) => {
    const sizeMap = {
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-14 w-14 text-base",
      xl: "h-20 w-20 text-xl",
    };

    const statusSizeMap = {
      sm: "h-2 w-2 ring-1",
      md: "h-2.5 w-2.5 ring-2",
      lg: "h-3.5 w-3.5 ring-2",
      xl: "h-4 w-4 ring-2",
    };

    const statusColorMap = {
      online: "bg-emerald-500",
      busy: "bg-amber-500",
      offline: "bg-zinc-400",
    };

    return (
      <AvatarContext.Provider value={{ size }}>
        <div
          ref={ref}
          className={cn(
            "relative inline-flex shrink-0 select-none items-center justify-center rounded-full bg-secondary border border-border overflow-hidden font-medium text-secondary-foreground",
            sizeMap[size],
            className
          )}
          {...props}
        >
          {children}
          {status && (
            <span
              className={cn(
                "absolute bottom-0 right-0 rounded-full ring-background",
                statusSizeMap[size],
                statusColorMap[status]
              )}
            />
          )}
        </div>
      </AvatarContext.Provider>
    );
  }
);
Avatar.displayName = "Avatar";

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  onLoadingStatusChange?: (status: "loading" | "loaded" | "error") => void;
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt = "Avatar", src, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    if (!src || hasError) return null;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={ref}
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className={cn("h-full w-full object-cover", className)}
        {...props}
      />
    );
  }
);
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center font-medium uppercase tracking-wider text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </span>
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
