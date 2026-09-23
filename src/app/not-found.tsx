import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="space-y-4 max-w-md">
        <span className="font-mono text-5xl font-black text-foreground/20">
          404
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The creative asset, workspace, or profile you requested does not exist or has been moved.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button variant="default" size="md" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Crewn Home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
