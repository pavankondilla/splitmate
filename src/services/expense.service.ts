import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import * as expenseRepo from "@/repositories/expense.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import { logActivity } from "@/repositories/activity-log.repository";
import { calculateEqualShares } from "@/lib/split";
import { restoreCreditsForDeletedExpense } from "@/services/credit.service";
import { sendExpenseAddedEmails } from "@/lib/email";
import type { ExpenseCategory, SplitType } from "@/types/domain";

export interface UpdateExpenseInput {
  title: string;
  amount: number;
  category: ExpenseCategory;
  splitType: SplitType;
  paidBy: string;
  notes?: string;
  expenseDate: string;
  participantIds: string[];
}

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

  // Best-effort email notifications — never block or fail the mutation.
  try {
    const room = await roomRepo.findRoomById(roomId);
    const notifyIds = data.participantIds.filter((id) => id !== userId);
    if (room && notifyIds.length > 0) {
      const [payer, recipients] = await Promise.all([
        userRepo.findUserById(data.paidBy),
        userRepo.findUsersByIds(notifyIds),
      ]);
      const shareMap = new Map(shares.map((s) => [s.userId, s.shareAmount]));
      await sendExpenseAddedEmails({
        roomId,
        roomName: room.name,
        expenseTitle: data.title,
        totalAmount: data.amount,
        payerName: payer?.name ?? "Someone",
        recipients: recipients.map((u) => ({
          email: u.email,
          name: u.name,
          shareAmount: shareMap.get(u.id) ?? 0,
        })),
      });
    }
  } catch (err) {
    console.error("[email] expense notification failed:", err);
  }

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

export async function updateExpense(expenseId: string, userId: string, data: UpdateExpenseInput) {
  const expense = await expenseRepo.findExpenseById(expenseId);
  if (!expense) throw new NotFoundError("Expense");

  const membership = await roomRepo.findRoomMember(expense.roomId, userId);
  if (!membership) throw new ForbiddenError();

  if (expense.createdBy !== userId && membership.role !== "admin") {
    throw new ForbiddenError("Only the creator or an admin can edit this expense");
  }

  const participants = await expenseRepo.findParticipantsByExpenseId(expenseId);
  if (participants.some((p) => p.creditApplied > 0)) {
    throw new ValidationError("This expense has credits applied and cannot be edited. Delete and re-add it if needed.");
  }

  if (data.participantIds.length === 0) {
    throw new ValidationError("At least one participant required");
  }

  const before = { title: expense.title, amount: expense.amount };

  await expenseRepo.updateExpense(expenseId, {
    title: data.title,
    amount: data.amount,
    category: data.category,
    splitType: data.splitType,
    paidBy: data.paidBy,
    notes: data.notes ?? null,
    expenseDate: data.expenseDate,
  });

  await expenseRepo.deleteParticipantsByExpenseId(expenseId);

  const shares = calculateEqualShares(data.amount, data.participantIds);
  await expenseRepo.createExpenseParticipants(
    shares.map((s) => ({ expenseId, userId: s.userId, shareAmount: s.shareAmount, isSettled: false }))
  );

  await logActivity({
    roomId: expense.roomId,
    actorId: userId,
    action: "EXPENSE_EDITED",
    entityType: "expense",
    entityId: expenseId,
    metadata: { before, after: { title: data.title, amount: data.amount } },
  });
}

export async function deleteExpense(expenseId: string, userId: string) {
  const expense = await expenseRepo.findExpenseById(expenseId);
  if (!expense) throw new NotFoundError("Expense");

  const membership = await roomRepo.findRoomMember(expense.roomId, userId);
  if (!membership) throw new ForbiddenError();

  if (expense.createdBy !== userId && membership.role !== "admin") {
    throw new ForbiddenError("Only the creator or an admin can delete this expense");
  }

  // Refund credit applied to this expense's shares before it disappears,
  // otherwise the consumed credit is orphaned and lost.
  const creditRestored = await restoreCreditsForDeletedExpense(expenseId);

  await expenseRepo.softDeleteExpense(expenseId);

  await logActivity({
    roomId: expense.roomId,
    actorId: userId,
    action: "EXPENSE_DELETED",
    entityType: "expense",
    entityId: expenseId,
    metadata: { title: expense.title, amount: expense.amount, creditRestored },
  });
}
