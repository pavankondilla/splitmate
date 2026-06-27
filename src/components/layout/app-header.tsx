"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, User } from "lucide-react";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-gray-900">
          <Wallet className="h-5 w-5 text-indigo-600" />
          SplitMate
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/profile"
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
