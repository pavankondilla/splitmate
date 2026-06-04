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
  const userMap = new Map(users.map((u) => [u.id, u]));

  const expensePaidByMap = new Map(expenses.map((e) => [e.id, e.paidBy]));

  // debt[fromId][toId] = raw amount fromId owes toId
  const debt = new Map<string, Map<string, number>>();

  const addDebt = (from: string, to: string, amount: number) => {
    if (!debt.has(from)) debt.set(from, new Map());
    const current = debt.get(from)!.get(to) ?? 0;
    debt.get(from)!.set(to, current + amount);
  };

  for (const p of participants) {
    const paidBy = expensePaidByMap.get(p.expenseId);
    if (paidBy && p.userId !== paidBy) {
      addDebt(p.userId, paidBy, p.shareAmount);
    }
  }

  for (const s of settlements) {
    addDebt(s.payerId, s.payeeId, -s.amount);
  }

  // Clamp negative debts — orphaned settlements (from deleted expenses) must not invert balances
  for (const toMap of debt.values()) {
    for (const [toId, amount] of toMap.entries()) {
      if (amount < 0) toMap.set(toId, 0);
    }
  }

  // Simplify each pair: net out A→B vs B→A
  const result: PairwiseBalance[] = [];
  const processed = new Set<string>();

  for (const [fromId, toMap] of debt.entries()) {
    for (const [toId] of toMap.entries()) {
      const pairKey = [fromId, toId].sort().join("|");
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const aOwesB = debt.get(fromId)?.get(toId) ?? 0;
      const bOwesA = debt.get(toId)?.get(fromId) ?? 0;
      const net = aOwesB - bOwesA;

      if (net > 0) {
        result.push({
          fromUserId: fromId,
          fromUserName: userMap.get(fromId)?.name ?? "Unknown",
          toUserId: toId,
          toUserName: userMap.get(toId)?.name ?? "Unknown",
          amount: net,
        });
      } else if (net < 0) {
        result.push({
          fromUserId: toId,
          fromUserName: userMap.get(toId)?.name ?? "Unknown",
          toUserId: fromId,
          toUserName: userMap.get(fromId)?.name ?? "Unknown",
          amount: -net,
        });
      }
    }
  }

  return result;
}
