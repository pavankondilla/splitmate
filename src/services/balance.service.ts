import { ForbiddenError } from "@/lib/errors";
import * as expenseRepo from "@/repositories/expense.repository";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
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

  return users.map((user) => {
    const { netBalance, totalOwedToUser, totalUserOwes } = computeNetBalance(
      user.id,
      expenses,
      participants,
      settlements
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

  // Accumulate expense shares per pair
  for (const p of participants) {
    const payerId = expensePaidByMap.get(p.expenseId);
    if (!payerId || p.userId === payerId) continue;
    setDebt(payerId, p.userId, getDebt(payerId, p.userId) + p.shareAmount);
  }

  // Subtract settlements — when participant pays payer, their debt decreases
  for (const s of settlements) {
    setDebt(s.payeeId, s.payerId, getDebt(s.payeeId, s.payerId) - s.amount);
  }

  // Build pairwise result from non-zero net debts
  const result: PairwiseBalance[] = [];

  for (const [payerId, debtMap] of pairDebts) {
    for (const [participantId, netDebt] of debtMap) {
      const rounded = Math.round(netDebt);
      if (rounded > 0) {
        // Participant still owes payer
        result.push({
          fromUserId: participantId,
          fromUserName: userMap.get(participantId) ?? "Unknown",
          toUserId: payerId,
          toUserName: userMap.get(payerId) ?? "Unknown",
          amount: rounded,
        });
      } else if (rounded < 0) {
        // Participant overpaid → payer owes participant
        result.push({
          fromUserId: payerId,
          fromUserName: userMap.get(payerId) ?? "Unknown",
          toUserId: participantId,
          toUserName: userMap.get(participantId) ?? "Unknown",
          amount: Math.abs(rounded),
        });
      }
    }
  }

  return result;
}
