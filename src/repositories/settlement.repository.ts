import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settlements, type NewSettlement } from "@/db/schema";

export async function createSettlement(data: NewSettlement) {
  const result = await db.insert(settlements).values(data).returning();
  return result[0];
}

export async function findSettlementById(id: string) {
  const result = await db
    .select()
    .from(settlements)
    .where(eq(settlements.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function findSettlementsByRoomId(roomId: string) {
  return db
    .select()
    .from(settlements)
    .where(eq(settlements.roomId, roomId));
}
