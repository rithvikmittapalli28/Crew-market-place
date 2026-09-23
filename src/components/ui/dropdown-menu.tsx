"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeMenu: () => void;
}

const DropdownContext = React.createContext<DropdownContextValue | undefined>(undefined);

function useDropdown() {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("useDropdown must be used within a DropdownMenu");
  }
  return context;
}

interface DropdownMenuProps {
  children: React.ReactNode;
}

function DropdownMenu({ children }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const closeMenu = React.useCallback(() => setIsOpen(false), []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeMenu]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, closeMenu }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, className, ...props }, ref) => {
  const { isOpen, setIsOpen } = useDropdown();

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={isOpen}
      onClick={(e) => {
        onClick?.(e);
        setIsOpen((prev) => !prev);
      }}
      className={className}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "left" | "right";
}

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  DropdownMenuContentProps
>(({ className, align = "right", ...props }, ref) => {
  const { isOpen } = useDropdown();

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95",
        align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }
>(({ className, onClick, inset, ...props }, ref) => {
  const { closeMenu } = useDropdown();

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e);
        closeMenu();
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors hover:bg-muted focus:bg-muted text-foreground/90 hover:text-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuLabel = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}
    {...props}
  />
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
