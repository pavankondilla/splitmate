import { ForbiddenError } from "@/lib/errors";
import * as expenseRepo from "@/repositories/expense.repository";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import * as creditRepo from "@/repositories/credit.repository";
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
  const allCredits = await creditRepo.findCreditsByRoom(roomId);

  return users.map((user) => {
    const { netBalance, totalOwedToUser, totalUserOwes } = computeNetBalance(
      user.id,
      expenses,
      participants,
      settlements,
      allCredits
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

  // Subtract settlements — when participant pays payer, their debt decreases
  for (const s of settlements) {
    setDebt(s.payeeId, s.payerId, getDebt(s.payeeId, s.payerId) - s.amount);
  }

  // Adjust for used credits — when userId used credit from owedByUserId, owedByUserId owes less
  const allCredits = await creditRepo.findCreditsByRoom(roomId);
  for (const credit of allCredits) {
    if (credit.usedCredit > 0) {
      setDebt(credit.owedByUserId, credit.userId,
        getDebt(credit.owedByUserId, credit.userId) + credit.usedCredit);
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
