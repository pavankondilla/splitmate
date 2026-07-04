"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MIN_INTERVAL_MS = 5000;

// Refetches server data when the user returns to the tab, so a phone that
// sat in the pocket shows fresh balances the moment it's opened. Throttled
// so rapid focus/blur cycles don't hammer the server. Renders nothing.
export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < MIN_INTERVAL_MS) return;
      lastRefresh.current = now;
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  return null;
}
