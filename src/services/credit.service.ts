import { ForbiddenError, NotFoundError } from "@/lib/errors";
import * as creditRepo from "@/repositories/credit.repository";
import * as expenseRepo from "@/repositories/expense.repository";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import { logActivity } from "@/repositories/activity-log.repository";

// Called after every settlement is recorded.
// Checks if the payer overpaid their actual debt to the payee for this pair.
// If so, creates a user_credit record for the surplus.
export async function detectAndCreateCredit(
  settlementId: string,
  payerId: string,
  payeeId: string,
  roomId: string
) {
  const expenses = await expenseRepo.findExpensesByRoomId(roomId);
  const expenseIds = expenses.map((e) => e.id);
  const participants = await expenseRepo.findParticipantsByExpenseIds(expenseIds);
  const allSettlements = await settlementRepo.findSettlementsByRoomId(roomId);

  // Sum what payer owes payee: expenses paid by payee where payer was a participant
  const totalOwed = participants
    .filter((p) => {
      const exp = expenses.find((e) => e.id === p.expenseId);
      return exp && exp.paidBy === payeeId && p.userId === payerId;
    })
    .reduce((sum, p) => sum + p.shareAmount, 0);

  // Sum all payments payer has made to payee
  const totalPaid = allSettlements
    .filter((s) => s.payerId === payerId && s.payeeId === payeeId)
    .reduce((sum, s) => sum + s.amount, 0);

  const overpayment = totalPaid - totalOwed;
  if (overpayment <= 0) return null;

  // Only create credit for the DELTA above existing credit records for this pair.
  // Prevents duplicate records when multiple settlements occur over time.
  const existingCredits = await creditRepo.findCreditsByUserRoomAndOwedBy(payerId, roomId, payeeId);
  const existingTotal = existingCredits.reduce((sum, c) => sum + c.totalCredit, 0);
  const delta = overpayment - existingTotal;
  if (delta <= 0) return null;

  const credit = await creditRepo.createCredit({
    userId: payerId,
    roomId,
    totalCredit: delta,
    usedCredit: 0,
    sourceSettlementId: settlementId,
    owedByUserId: payeeId,
    isExhausted: false,
  });

  return credit;
}

// Returns available (non-exhausted) credits for a user in a room.
export async function getAvailableCredits(userId: string, roomId: string) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const credits = await creditRepo.findCreditsByUserAndRoom(userId, roomId);
  return credits.map((c) => ({
    ...c,
    availableCredit: c.totalCredit - c.usedCredit,
  }));
}

// Returns total available credit pool for a user in a room (sum across all credits).
export async function getTotalAvailableCredit(userId: string, roomId: string): Promise<number> {
  const credits = await creditRepo.findCreditsByUserAndRoom(userId, roomId);
  return credits.reduce((sum, c) => sum + (c.totalCredit - c.usedCredit), 0);
}

// Called after a settlement is recorded.
// If the payee has credits with owedByUserId = payer, reduce them by the settlement amount.
// This handles the case where payer is "returning" overpayment credit back to payee.
export async function consumeCreditsOnSettlement(
  payerId: string,
  payeeId: string,
  settlementAmount: number,
  roomId: string
) {
  // Find active credits belonging to payee that payer owes
  const credits = await creditRepo.findCreditsByUserRoomAndOwedBy(payeeId, roomId, payerId);
  const activeCredits = credits.filter((c) => !c.isExhausted);
  if (activeCredits.length === 0) return;

  let remaining = settlementAmount;
  for (const credit of activeCredits) {
    if (remaining <= 0) break;
    const available = credit.totalCredit - credit.usedCredit;
    if (available <= 0) continue;

    const consume = Math.min(available, remaining);
    const newUsed = credit.usedCredit + consume;
    const isExhausted = newUsed >= credit.totalCredit;
    await creditRepo.updateCreditUsed(credit.id, newUsed, isExhausted);
    remaining -= consume;
  }
}

export interface ApplyCreditInput {
  expenseParticipantId: string; // which participant share to cover
}

// Applies the user's available credit to a PENDING expense share.
// Only the participant themselves can apply their own credit.
export async function applyCredit(
  userId: string,
  roomId: string,
  input: ApplyCreditInput
) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const participant = await creditRepo.findParticipantById(input.expenseParticipantId);
  if (!participant) throw new NotFoundError("Expense share");

  // Only the participant themselves can apply credit to their own share
  if (participant.userId !== userId) throw new ForbiddenError();

  // Already credited or settled — nothing to do
  if (participant.creditApplied > 0 || participant.isSettled) {
    throw new Error("This share is already settled or credited");
  }

  const availableCredits = await creditRepo.findCreditsByUserAndRoom(userId, roomId);
  const totalAvailable = availableCredits.reduce((sum, c) => sum + (c.totalCredit - c.usedCredit), 0);

  if (totalAvailable <= 0) throw new Error("No credit available");

  // Apply up to the share amount
  const applyAmount = Math.min(participant.shareAmount, totalAvailable);

  // Deduct from credit records (oldest first)
  let remaining = applyAmount;
  for (const credit of availableCredits) {
    if (remaining <= 0) break;
    const available = credit.totalCredit - credit.usedCredit;
    if (available <= 0) continue;

    const deduct = Math.min(available, remaining);
    const newUsed = credit.usedCredit + deduct;
    const isExhausted = newUsed >= credit.totalCredit;
    await creditRepo.updateCreditUsed(credit.id, newUsed, isExhausted);
    remaining -= deduct;
  }

  // Mark the participant share as credited
  const updated = await creditRepo.applyParticipantCredit(input.expenseParticipantId, applyAmount);

  await logActivity({
    roomId,
    actorId: userId,
    action: "CREDIT_APPLIED",
    entityType: "expense",
    entityId: participant.expenseId,
    metadata: {
      participantId: participant.id,
      amountCredited: applyAmount,
      shareAmount: participant.shareAmount,
      partialCredit: applyAmount < participant.shareAmount,
    },
  });

  return {
    participant: updated,
    amountCredited: applyAmount,
    remainingShare: participant.shareAmount - applyAmount,
    creditFullyCovers: applyAmount >= participant.shareAmount,
  };
}
