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

  // Derive pairwise from net balances using greedy settlement algorithm.
  // This is consistent with getRoomBalances and avoids debt-map clamping issues.
  const netBalances = users.map((user) => {
    const { netBalance } = computeNetBalance(user.id, expenses, participants, settlements);
    return { userId: user.id, userName: user.name, remaining: netBalance };
  });

  const creditors = netBalances
    .filter((b) => b.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = netBalances
    .filter((b) => b.remaining < 0)
    .map((b) => ({ ...b, remaining: Math.abs(b.remaining) }))
    .sort((a, b) => b.remaining - a.remaining);

  const result: PairwiseBalance[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.remaining, debtor.remaining);

    if (amount > 0) {
      result.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.userName,
        toUserId: creditor.userId,
        toUserName: creditor.userName,
        amount,
      });
    }

    creditor.remaining -= amount;
    debtor.remaining -= amount;

    if (creditor.remaining <= 0) ci++;
    if (debtor.remaining <= 0) di++;
  }

  return result;
}
