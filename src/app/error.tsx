"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="flex items-center justify-center gap-2 font-semibold text-gray-900 mb-10">
              <Wallet className="h-5 w-5 text-indigo-600" />
              SplitMate
            </div>

            <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-9 w-9 text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-2">
              An unexpected error occurred. Your data is safe.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 font-mono mb-6">Error ID: {error.digest}</p>
            )}
            {!error.digest && <div className="mb-6" />}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                onClick={reset}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Link href="/">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
