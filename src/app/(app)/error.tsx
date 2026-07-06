"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-20 w-20 bg-red-50 dark:bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="h-9 w-9 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
      <p className="text-muted-foreground text-sm mb-2 max-w-sm">
        An unexpected error occurred. Your data is safe — try refreshing or go back to the dashboard.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono mb-6">Error ID: {error.digest}</p>
      )}
      {!error.digest && <div className="mb-6" />}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          className="gap-2"
          onClick={reset}
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
