import { and, desc, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { expenses, expenseParticipants, type NewExpense, type NewExpenseParticipant } from "@/db/schema";

export async function createExpense(data: NewExpense) {
  const result = await db.insert(expenses).values(data).returning();
  return result[0];
}

export async function createExpenseParticipants(data: NewExpenseParticipant[]) {
  if (data.length === 0) return [];
  return db.insert(expenseParticipants).values(data).returning();
}

export async function findExpenseById(id: string) {
  const result = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function findExpensesByRoomId(roomId: string) {
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.roomId, roomId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
}

export async function findParticipantsByExpenseId(expenseId: string) {
  return db
    .select()
    .from(expenseParticipants)
    .where(eq(expenseParticipants.expenseId, expenseId));
}

export async function findParticipantsByExpenseIds(expenseIds: string[]) {
  if (expenseIds.length === 0) return [];
  return db
    .select()
    .from(expenseParticipants)
    .where(inArray(expenseParticipants.expenseId, expenseIds));
}

export async function updateExpense(
  id: string,
  data: Pick<NewExpense, "title" | "amount" | "category" | "splitType" | "paidBy" | "notes" | "expenseDate">
) {
  const result = await db
    .update(expenses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(expenses.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deleteParticipantsByExpenseId(expenseId: string) {
  return db.delete(expenseParticipants).where(eq(expenseParticipants.expenseId, expenseId));
}

export async function softDeleteExpense(id: string) {
  const result = await db
    .update(expenses)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(expenses.id, id))
    .returning();
  return result[0] ?? null;
}
