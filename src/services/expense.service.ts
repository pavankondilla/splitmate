import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import * as expenseRepo from "@/repositories/expense.repository";
import * as roomRepo from "@/repositories/room.repository";
import { logActivity } from "@/repositories/activity-log.repository";
import { calculateEqualShares } from "@/lib/split";
import type { ExpenseCategory, SplitType } from "@/types/domain";

export interface AddExpenseInput {
  title: string;
  amount: number;
  category: ExpenseCategory;
  splitType: SplitType;
  paidBy: string;
  notes?: string;
  expenseDate: string;
  participantIds: string[];
}

export async function addExpense(userId: string, roomId: string, data: AddExpenseInput) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  if (data.participantIds.length === 0) {
    throw new ValidationError("At least one participant required");
  }

  const expense = await expenseRepo.createExpense({
    roomId,
    title: data.title,
    amount: data.amount,
    category: data.category,
    splitType: data.splitType,
    paidBy: data.paidBy,
    notes: data.notes ?? null,
    expenseDate: data.expenseDate,
    createdBy: userId,
  });

  const shares = calculateEqualShares(data.amount, data.participantIds);
  const participants = shares.map((s) => ({
    expenseId: expense.id,
    userId: s.userId,
    shareAmount: s.shareAmount,
    isSettled: false,
  }));

  await expenseRepo.createExpenseParticipants(participants);

  await logActivity({
    roomId,
    actorId: userId,
    action: "EXPENSE_ADDED",
    entityType: "expense",
    entityId: expense.id,
    metadata: { title: data.title, amount: data.amount },
  });

  return expense;
}

export async function getRoomExpenses(roomId: string, userId: string) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const expenses = await expenseRepo.findExpensesByRoomId(roomId);
  const expenseIds = expenses.map((e) => e.id);
  const participants = await expenseRepo.findParticipantsByExpenseIds(expenseIds);

  const participantMap = new Map<string, typeof participants>();
  for (const p of participants) {
    const list = participantMap.get(p.expenseId) ?? [];
    list.push(p);
    participantMap.set(p.expenseId, list);
  }

  return expenses.map((e) => ({
    ...e,
    participants: participantMap.get(e.id) ?? [],
  }));
}

export async function deleteExpense(expenseId: string, userId: string) {
  const expense = await expenseRepo.findExpenseById(expenseId);
  if (!expense) throw new NotFoundError("Expense");

  const membership = await roomRepo.findRoomMember(expense.roomId, userId);
  if (!membership) throw new ForbiddenError();

  if (expense.createdBy !== userId && membership.role !== "admin") {
    throw new ForbiddenError("Only the creator or an admin can delete this expense");
  }

  await expenseRepo.softDeleteExpense(expenseId);

  await logActivity({
    roomId: expense.roomId,
    actorId: userId,
    action: "EXPENSE_DELETED",
    entityType: "expense",
    entityId: expenseId,
    metadata: { title: expense.title, amount: expense.amount },
  });
}
