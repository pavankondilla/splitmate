import Pusher from "pusher";

// Server-side realtime publisher. Best-effort by design: if Pusher env vars
// are missing (local dev without an account) or the publish fails, mutations
// must proceed unaffected — clients simply fall back to refresh-on-focus.
let pusher: Pusher | null | undefined;

function getPusher(): Pusher | null {
  if (pusher !== undefined) return pusher;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  pusher = appId && key && secret && cluster
    ? new Pusher({ appId, key, secret, cluster, useTLS: true })
    : null;
  return pusher;
}

export function roomChannel(roomId: string) {
  return `room-${roomId}`;
}

// Intentionally carries no payload — the event only tells clients "this room
// changed, refetch". All data still flows through the authorized API/page.
export async function publishRoomUpdate(roomId: string): Promise<void> {
  const client = getPusher();
  if (!client) return;
  try {
    await client.trigger(roomChannel(roomId), "updated", {});
  } catch (err) {
    console.error("[realtime] publish failed:", err);
  }
}
