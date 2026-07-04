"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";

// One connection shared across mounts/navigations — Pusher counts concurrent
// connections, and reconnecting on every room visit would waste them.
let sharedClient: Pusher | null = null;

function getClient(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;
  if (!sharedClient) sharedClient = new Pusher(key, { cluster });
  return sharedClient;
}

// Subscribes to this room's channel and refreshes the page data when any
// member mutates the room. Events carry no data — the refresh refetches
// everything through the normal authorized server path. Renders nothing,
// and is a no-op when Pusher env vars aren't configured.
export function RoomRealtime({ roomId }: { roomId: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = getClient();
    if (!client) return;

    const channel = client.subscribe(`room-${roomId}`);
    const onUpdate = () => {
      // Debounce: one settlement can emit several events (settlement + credit
      // hooks) — coalesce them into a single refresh.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 400);
    };
    channel.bind("updated", onUpdate);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      channel.unbind("updated", onUpdate);
      client.unsubscribe(`room-${roomId}`);
    };
  }, [roomId, router]);

  return null;
}
