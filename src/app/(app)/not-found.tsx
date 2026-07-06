"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-20 w-20 bg-indigo-50 dark:bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl font-bold text-indigo-400 dark:text-indigo-300">404</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm">
        This room doesn&apos;t exist, was deleted, or you&apos;re not a member.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/dashboard">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <Button variant="outline" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    </div>
  );
}
