import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { userCredits, expenseParticipants, type NewUserCredit } from "@/db/schema";

export async function createCredit(data: NewUserCredit) {
  const result = await db.insert(userCredits).values(data).returning();
  return result[0];
}

export async function findCreditsByUserAndRoom(userId: string, roomId: string) {
  return db
    .select()
    .from(userCredits)
    .where(
      and(
        eq(userCredits.userId, userId),
        eq(userCredits.roomId, roomId),
        eq(userCredits.isExhausted, false)
      )
    );
}

export async function findCreditsByUserRoomAndOwedBy(userId: string, roomId: string, owedByUserId: string) {
  return db
    .select()
    .from(userCredits)
    .where(
      and(
        eq(userCredits.userId, userId),
        eq(userCredits.roomId, roomId),
        eq(userCredits.owedByUserId, owedByUserId)
      )
    );
}

export async function findCreditsByRoom(roomId: string) {
  return db
    .select()
    .from(userCredits)
    .where(eq(userCredits.roomId, roomId));
}

export async function updateCreditUsed(creditId: string, usedCredit: number, isExhausted: boolean) {
  const result = await db
    .update(userCredits)
    .set({ usedCredit, isExhausted, updatedAt: new Date() })
    .where(eq(userCredits.id, creditId))
    .returning();
  return result[0];
}

export async function updateCreditStatus(creditId: string, status: "ACTIVE" | "PENDING_SETTLEMENT" | "SETTLED") {
  const result = await db
    .update(userCredits)
    .set({ status, updatedAt: new Date() })
    .where(eq(userCredits.id, creditId))
    .returning();
  return result[0];
}

export async function confirmParticipantCredit(participantId: string) {
  const result = await db
    .update(expenseParticipants)
    .set({ creditConfirmed: true })
    .where(eq(expenseParticipants.id, participantId))
    .returning();
  return result[0];
}

export async function findParticipantById(participantId: string) {
  const result = await db
    .select()
    .from(expenseParticipants)
    .where(eq(expenseParticipants.id, participantId))
    .limit(1);
  return result[0] ?? null;
}

export async function applyParticipantCredit(participantId: string, creditAmount: number) {
  const result = await db
    .update(expenseParticipants)
    .set({ creditApplied: creditAmount })
    .where(eq(expenseParticipants.id, participantId))
    .returning();
  return result[0];
}
