"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Wallet } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-gray-900">
          <Wallet className="h-5 w-5 text-indigo-600" />
          SplitMate
        </Link>
        <UserButton />
      </div>
    </header>
  );
}
