import { ForbiddenError } from "@/lib/errors";
import * as expenseRepo from "@/repositories/expense.repository";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import * as creditRepo from "@/repositories/credit.repository";
import * as proposalRepo from "@/repositories/proposal.repository";
import type { Balance, PairwiseBalance } from "@/types/domain";
import { computeNetBalance } from "@/lib/balance";

export { computeNetBalance };

export async function getRoomBalances(roomId: string, userId: string): Promise<Balance[]> {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const members = await roomRepo.findRoomMembers(roomId);
  const memberIds = members.map((m) => m.userId);

  const expenses = await expenseRepo.findExpensesByRoomId(roomId);
  const expenseIds = expenses.map((e) => e.id);
  const participants = await expenseRepo.findParticipantsByExpenseIds(expenseIds);
  const settlements = await settlementRepo.findSettlementsByRoomId(roomId);
  const users = await userRepo.findUsersByIds(memberIds);
  const allCredits = await creditRepo.findAllCreditsByRoom(roomId);
  const confirmedProposals = await proposalRepo.findConfirmedProposalsByRoom(roomId);

  return users.map((user) => {
    const { netBalance, totalOwedToUser, totalUserOwes } = computeNetBalance(
      user.id,
      expenses,
      participants,
      settlements,
      allCredits,
      confirmedProposals
    );
    return {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl ?? null,
      netBalance,
      totalOwedToUser,
      totalUserOwes,
    };
  });
}

export async function getPairwiseBalances(roomId: string, userId: string): Promise<PairwiseBalance[]> {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const members = await roomRepo.findRoomMembers(roomId);
  const memberIds = members.map((m) => m.userId);

  const expenses = await expenseRepo.findExpensesByRoomId(roomId);
  const expenseIds = expenses.map((e) => e.id);
  const participants = await expenseRepo.findParticipantsByExpenseIds(expenseIds);
  const settlements = await settlementRepo.findSettlementsByRoomId(roomId);
  const users = await userRepo.findUsersByIds(memberIds);

  // Per-pair actual debt tracking:
  // For each (payer, participant) pair, compute the exact net amount owed
  // based on real expense shares and real settlements — not reconstructed flows.
  // This preserves actual money relationships (C owes A, not C owes B).
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const expensePaidByMap = new Map(expenses.map(e => [e.id, e.paidBy]));

  // pairDebts[payerId][participantId] = net amount participant owes payer
  // positive  → participant owes payer
  // negative  → payer owes participant (participant overpaid)
  const pairDebts = new Map<string, Map<string, number>>();

  const getDebt = (payerId: string, participantId: string) =>
    pairDebts.get(payerId)?.get(participantId) ?? 0;

  const setDebt = (payerId: string, participantId: string, amount: number) => {
    if (!pairDebts.has(payerId)) pairDebts.set(payerId, new Map());
    pairDebts.get(payerId)!.set(participantId, amount);
  };

  // Accumulate expense shares per pair — use effective share (minus any credit applied)
  for (const p of participants) {
    const payerId = expensePaidByMap.get(p.expenseId);
    if (!payerId || p.userId === payerId) continue;
    const effectiveShare = Math.max(0, p.shareAmount - p.creditApplied);
    setDebt(payerId, p.userId, getDebt(payerId, p.userId) + effectiveShare);
  }

  // Subtract settlements — when participant pays payer, their debt decreases.
  // The portion of a settlement that confirmed a proposal was paid on behalf
  // of someone else's credit — it must NOT reduce the payer's own debt to the
  // payee. Its effect is reattributed by the SETTLED-credit adjustment below
  // (it reduces the payer's credit debt to the credit holder instead).
  const confirmedProposals = await proposalRepo.findConfirmedProposalsByRoom(roomId);
  const proposalCoveredBySettlement = new Map<string, number>();
  for (const pr of confirmedProposals) {
    if (pr.confirmedSettlementId) {
      proposalCoveredBySettlement.set(
        pr.confirmedSettlementId,
        (proposalCoveredBySettlement.get(pr.confirmedSettlementId) ?? 0) + pr.amount
      );
    }
  }
  for (const s of settlements) {
    const ownPortion = s.amount - (proposalCoveredBySettlement.get(s.id) ?? 0);
    if (ownPortion === 0) continue;
    setDebt(s.payeeId, s.payerId, getDebt(s.payeeId, s.payerId) - ownPortion);
  }

  // Adjust for used credits — only SETTLED credits with confirmed participants count here.
  // PENDING_SETTLEMENT credits are not finalized; exclude until proposal is confirmed.
  // Settlement-return portion is already captured in the settlements loop above.
  const expenseCreditUsed = new Map<string, number>();
  for (const p of participants) {
    if (p.creditApplied > 0 && p.creditConfirmed) {
      expenseCreditUsed.set(p.userId, (expenseCreditUsed.get(p.userId) ?? 0) + p.creditApplied);
    }
  }
  const allCredits = await creditRepo.findAllCreditsByRoom(roomId);
  for (const credit of allCredits) {
    const autoUsed = Math.min(credit.usedCredit, expenseCreditUsed.get(credit.userId) ?? 0);
    if (autoUsed > 0) {
      setDebt(credit.owedByUserId, credit.userId,
        getDebt(credit.owedByUserId, credit.userId) + autoUsed);
    }
  }

  // Flatten pairDebts into a canonical single-direction map.
  // If A owes B ₹900 AND B owes A ₹700, net to one line: A owes B ₹200.
  // Canonical key: smaller userId first → "id1:id2" always represents id1→id2.
  const netted = new Map<string, { fromId: string; toId: string; amount: number }>();

  for (const [payerId, debtMap] of pairDebts) {
    for (const [participantId, rawDebt] of debtMap) {
      const debt = Math.round(rawDebt);
      if (debt === 0) continue;

      // Determine actual direction
      const fromId = debt > 0 ? participantId : payerId;
      const toId   = debt > 0 ? payerId       : participantId;
      const amt    = Math.abs(debt);

      // Canonical key — always smaller string first to deduplicate A→B and B→A
      const canonKey = [fromId, toId].sort().join(":");
      const existing = netted.get(canonKey);

      if (!existing) {
        netted.set(canonKey, { fromId, toId, amount: amt });
      } else {
        if (existing.fromId === fromId) {
          // Same direction — add
          existing.amount += amt;
        } else {
          // Opposite direction — subtract (net)
          existing.amount -= amt;
          if (existing.amount < 0) {
            // Direction flipped
            existing.fromId = fromId;
            existing.toId   = toId;
            existing.amount = Math.abs(existing.amount);
          }
        }
      }
    }
  }

  const result: PairwiseBalance[] = [];
  for (const { fromId, toId, amount } of netted.values()) {
    if (amount < 1) continue;
    result.push({
      fromUserId:   fromId,
      fromUserName: userMap.get(fromId) ?? "Unknown",
      toUserId:     toId,
      toUserName:   userMap.get(toId)   ?? "Unknown",
      amount,
    });
  }

  return result;
}
