"use client";

import * as React from "react";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg space-y-4">
        <ErrorState
          title="Application error encountered"
          message={error.message || "An unexpected error interrupted this session. Please try again."}
          reset={reset}
          actionText="Reload Workspace"
        />
        <div className="text-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
