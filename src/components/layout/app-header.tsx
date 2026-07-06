"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { SplitMateLogo } from "./splitmate-logo";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-foreground">
          <SplitMateLogo />
          <span className="font-money text-[17px] tracking-tight">SplitMate</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/profile"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
