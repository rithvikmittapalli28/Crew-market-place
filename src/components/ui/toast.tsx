"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

let toastCount = 0;
let globalAddToast: ((toast: Omit<ToastItem, "id">) => void) | null = null;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `toast-${++toastCount}`;
      const newToast: ToastItem = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration ?? 4000;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  React.useEffect(() => {
    globalAddToast = addToast;
    return () => {
      globalAddToast = null;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export const toast = {
  success: (title: string, description?: string) => {
    globalAddToast?.({ title, description, type: "success" });
  },
  error: (title: string, description?: string) => {
    globalAddToast?.({ title, description, type: "error" });
  },
  info: (title: string, description?: string) => {
    globalAddToast?.({ title, description, type: "info" });
  },
  warning: (title: string, description?: string) => {
    globalAddToast?.({ title, description, type: "warning" });
  },
};

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-md flex-col gap-2 p-4 sm:bottom-6 sm:right-6 pointer-events-none">
      {toasts.map((item) => (
        <ToastCard key={item.id} toast={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  };

  return (
    <div
      role="alert"
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xl text-card-foreground transition-all duration-200 animate-in slide-in-from-bottom-5"
    >
      {icons[toast.type]}
      <div className="flex-1 space-y-0.5">
        <h4 className="text-sm font-semibold">{toast.title}</h4>
        {toast.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-lg"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}
