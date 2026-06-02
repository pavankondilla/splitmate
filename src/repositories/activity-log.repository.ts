import { db } from "@/db";
import { activityLogs, type NewActivityLog } from "@/db/schema";

export async function logActivity(data: NewActivityLog) {
  const result = await db.insert(activityLogs).values(data).returning();
  return result[0];
}
