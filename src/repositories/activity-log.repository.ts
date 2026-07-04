import { after } from "next/server";
import { db } from "@/db";
import { activityLogs, type NewActivityLog } from "@/db/schema";
import { publishRoomUpdate } from "@/lib/realtime";

export async function logActivity(data: NewActivityLog) {
  const result = await db.insert(activityLogs).values(data).returning();

  // Every mutation logs activity, so this is the single realtime publish
  // point: notify room members' clients that the room changed. after() defers
  // it past the response; outside a request scope (tests/scripts) it throws,
  // so fall back to fire-and-forget. Never fails the mutation either way.
  if (data.roomId) {
    const roomId = data.roomId;
    try {
      after(() => publishRoomUpdate(roomId));
    } catch {
      void publishRoomUpdate(roomId);
    }
  }

  return result[0];
}
