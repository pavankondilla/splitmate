import { ForbiddenError, NotFoundError } from "@/lib/errors";
import * as creditRepo from "@/repositories/credit.repository";
import * as expenseRepo from "@/repositories/expense.repository";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as proposalRepo from "@/repositories/proposal.repository";
import * as userRepo from "@/repositories/user.repository";
import { logActivity } from "@/repositories/activity-log.repository";
import { computeCreditReturnPortion } from "@/lib/credit";

export async function confirmProposalsForSettlement(
  roomId: string,
  payerId: string,
  payeeId: string,
  settlementAmount: number,
  settlementId: string
) {
  const toConfirm = await proposalRepo.getProposalsToConfirm(roomId, payerId, payeeId, settlementAmount);
  for (const proposal of toConfirm) {
    await proposalRepo.updateProposalStatus(proposal.id, "CONFIRMED", settlementId);
    if (proposal.sourceCreditId) {
      const credit = await creditRepo.findCreditById(proposal.sourceCreditId);
      if (credit) {
        await creditRepo.updateCreditUsed(proposal.sourceCreditId, credit.totalCredit, true);
      }
      await creditRepo.updateCreditStatus(proposal.sourceCreditId, "SETTLED");
    }
    if (proposal.participantId) {
      // A share can be covered by multiple credits, each with its own proposal.
      // creditConfirmed covers the whole creditApplied amount, so only confirm
      // once every proposal for this share has been resolved.
      const stillPending = await proposalRepo.findPendingProposalsByParticipantId(proposal.participantId);
      if (stillPending.length === 0) {
        await creditRepo.confirmParticipantCredit(proposal.participantId);
      }
    }
  }
}

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

  // If payee has existing credits owed by payer, the settlement is returning those credits
  // (not a genuine new overpayment). Subtract historical credit debt before checking for surplus.
  const payeeCreditsFromPayer = await creditRepo.findCreditsByUserRoomAndOwedBy(payeeId, roomId, payerId);
  const totalCreditDebt = payeeCreditsFromPayer.reduce((sum, c) => sum + c.totalCredit, 0);
  const adjustedOverpayment = overpayment - totalCreditDebt;
  if (adjustedOverpayment <= 0) return null;

  // Only create credit for the DELTA above existing credit records for this pair.
  // Prevents duplicate records when multiple settlements occur over time.
  const existingCredits = await creditRepo.findCreditsByUserRoomAndOwedBy(payerId, roomId, payeeId);
  const existingTotal = existingCredits.reduce((sum, c) => sum + c.totalCredit, 0);
  const delta = adjustedOverpayment - existingTotal;
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

// Returns all credit records for a room (every member's credits).
// Used by the Activity tab to display credit remaining from the DB
// instead of deriving it from the expense/settlement timeline.
export async function getRoomCredits(roomId: string, userId: string) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const credits = await creditRepo.findCreditsByRoom(roomId);
  return credits.map((c) => ({
    id: c.id,
    userId: c.userId,
    owedByUserId: c.owedByUserId,
    totalCredit: c.totalCredit,
    usedCredit: c.usedCredit,
    isExhausted: c.isExhausted,
    status: c.status,
  }));
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
// If the payee has credits with owedByUserId = payer, the payer may be
// "returning" overpayment credit back to the payee — but only the portion of
// the settlement that exceeds the payer's outstanding expense debt counts.
// A payment covering normal expense shares must not consume the payee's credits.
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

  const expenses = await expenseRepo.findExpensesByRoomId(roomId);
  const expenseIds = expenses.map((e) => e.id);
  const participants = await expenseRepo.findParticipantsByExpenseIds(expenseIds);
  const allSettlements = await settlementRepo.findSettlementsByRoomId(roomId);

  // Payer's expense debt to payee, net of credit already applied to those shares
  const paidByMap = new Map(expenses.map((e) => [e.id, e.paidBy]));
  const totalEffectiveOwed = participants
    .filter((p) => p.userId === payerId && paidByMap.get(p.expenseId) === payeeId)
    .reduce((sum, p) => sum + Math.max(0, p.shareAmount - p.creditApplied), 0);

  // Includes the settlement just recorded (this runs after it is created)
  const totalPaid = allSettlements
    .filter((s) => s.payerId === payerId && s.payeeId === payeeId)
    .reduce((sum, s) => sum + s.amount, 0);

  let remaining = computeCreditReturnPortion(settlementAmount, totalEffectiveOwed, totalPaid);

  // Consume credits proportional to how much of this settlement is an overpayment return
  if (remaining > 0) {
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

  // If payer has now fully covered their expense debt, any leftover PARTIAL
  // credit (usedCredit > 0) can never be applied again — exhaust it.
  // Fresh credits (usedCredit === 0) are untouched: they remain valid for
  // future expenses. This guards against totalEffectiveOwed=0 making any
  // A→B settlement incorrectly exhaust unrelated credits held by B.
  if (totalEffectiveOwed > 0 && totalPaid >= totalEffectiveOwed) {
    for (const credit of activeCredits) {
      if (credit.usedCredit > 0) {
        await creditRepo.updateCreditUsed(credit.id, credit.totalCredit, true);
      }
    }
  }
}

// Reduces a credit's usedCredit by the given amount, reactivating it if it
// was exhausted or settled and now has available balance again.
async function refundCredit(creditId: string, amount: number) {
  const credit = await creditRepo.findCreditById(creditId);
  if (!credit || amount <= 0) return 0;

  const refund = Math.min(credit.usedCredit, amount);
  if (refund <= 0) return 0;

  const newUsed = credit.usedCredit - refund;
  await creditRepo.updateCreditUsed(credit.id, newUsed, newUsed >= credit.totalCredit);
  if (credit.status !== "ACTIVE" && newUsed < credit.totalCredit) {
    await creditRepo.updateCreditStatus(credit.id, "ACTIVE");
  }
  return refund;
}

// Unwinds credit applied to an expense's shares when the expense is deleted.
// Pending proposals are dismissed and their credit refunded. Portions already
// settled with real money (confirmed proposals) are left untouched — the cash
// moved, so the ledger must keep reflecting it.
// Returns the total amount of credit restored (paise).
export async function restoreCreditsForDeletedExpense(expenseId: string) {
  const expense = await expenseRepo.findExpenseById(expenseId);
  if (!expense) return 0;

  const participants = await expenseRepo.findParticipantsByExpenseId(expenseId);
  let totalRestored = 0;

  for (const p of participants) {
    if (p.creditApplied <= 0) continue;

    const proposals = await proposalRepo.findProposalsByParticipantId(p.id);
    let pendingRefunded = 0;
    let confirmedAmount = 0;

    for (const proposal of proposals) {
      if (proposal.status === "PROPOSED") {
        await proposalRepo.updateProposalStatus(proposal.id, "DISMISSED");
        if (proposal.sourceCreditId) {
          await refundCredit(proposal.sourceCreditId, proposal.amount);
        }
        pendingRefunded += proposal.amount;
      } else if (proposal.status === "CONFIRMED") {
        confirmedAmount += proposal.amount;
      }
    }

    // Whatever remains was instantly settled against credits owed by the
    // expense payer — refund those (settled ones first, best effort).
    let remainder = p.creditApplied - pendingRefunded - confirmedAmount;
    let instantRefunded = 0;
    if (remainder > 0) {
      const credits = await creditRepo.findCreditsByUserRoomAndOwedBy(p.userId, expense.roomId, expense.paidBy);
      const ordered = [...credits].sort(
        (a, b) => Number(b.status === "SETTLED") - Number(a.status === "SETTLED")
      );
      for (const credit of ordered) {
        if (remainder <= 0) break;
        const refunded = await refundCredit(credit.id, remainder);
        remainder -= refunded;
        instantRefunded += refunded;
      }
    }

    await creditRepo.resetParticipantCredit(p.id);
    totalRestored += pendingRefunded + instantRefunded;
  }

  return totalRestored;
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

  // Deduct from credit records (oldest first), track what was consumed for proposal creation
  const creditsConsumed: Array<{ creditId: string; owedByUserId: string; deductAmount: number }> = [];
  let remaining = applyAmount;
  for (const credit of availableCredits) {
    if (remaining <= 0) break;
    const available = credit.totalCredit - credit.usedCredit;
    if (available <= 0) continue;

    const deduct = Math.min(available, remaining);
    const newUsed = credit.usedCredit + deduct;
    const isExhausted = newUsed >= credit.totalCredit;
    await creditRepo.updateCreditUsed(credit.id, newUsed, isExhausted);
    creditsConsumed.push({ creditId: credit.id, owedByUserId: credit.owedByUserId, deductAmount: deduct });
    remaining -= deduct;
  }

  // Mark the participant share as credited
  const updated = await creditRepo.applyParticipantCredit(input.expenseParticipantId, applyAmount);

  // For each credit consumed:
  // - If owedByUserId === expense.paidBy: no proposal needed, settle immediately
  // - Else: mark PENDING_SETTLEMENT, create a proposal for the debtor to pay the expense payer
  const expense = await expenseRepo.findExpenseById(participant.expenseId);
  if (expense) {
    const applierUser = await userRepo.findUserById(userId);
    const applierName = applierUser?.name ?? "A member";
    let proposalsCreated = 0;
    for (const { creditId, owedByUserId, deductAmount } of creditsConsumed) {
      if (owedByUserId === expense.paidBy) {
        // Debtor IS the expense payer — credit directly offsets the debt, no proposal needed
        await creditRepo.updateCreditStatus(creditId, "SETTLED");
      } else {
        proposalsCreated++;
        await creditRepo.updateCreditStatus(creditId, "PENDING_SETTLEMENT");
        await proposalRepo.createProposal({
          roomId,
          fromUserId: owedByUserId,
          toUserId: expense.paidBy,
          amount: deductAmount,
          reason: `${applierName} applied ₹${(deductAmount / 100).toLocaleString("en-IN")} credit to "${expense.title}"`,
          triggeredByUserId: userId,
          sourceCreditId: creditId,
          participantId: participant.id,
          status: "PROPOSED",
        });
      }
    }
    // creditConfirmed is a single flag covering the whole creditApplied amount —
    // only confirm now if no portion is awaiting a settlement proposal. Otherwise
    // confirmation happens when the last pending proposal is confirmed.
    if (proposalsCreated === 0) {
      await creditRepo.confirmParticipantCredit(participant.id);
    }
  }

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
