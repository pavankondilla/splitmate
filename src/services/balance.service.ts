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

  // Single-payment-per-debtor algorithm:
  // Each debtor pays their full balance to the largest creditor in one shot.
  // If that creditor receives more than they are owed, they become a debtor for
  // the excess and pass it to the next creditor. This ensures every original
  // debtor makes exactly ONE payment.
  const netBalances = users.map((user) => {
    const { netBalance } = computeNetBalance(user.id, expenses, participants, settlements);
    return { userId: user.id, userName: user.name, remaining: netBalance };
  });

  const working = netBalances.map(b => ({ ...b }));

  const result: PairwiseBalance[] = [];

  while (true) {
    const currentDebtors = working
      .filter(b => b.remaining < -0.5)
      .sort((a, b) => a.remaining - b.remaining); // most negative first

    const currentCreditors = working
      .filter(b => b.remaining > 0.5)
      .sort((a, b) => b.remaining - a.remaining); // most positive first

    if (currentDebtors.length === 0 || currentCreditors.length === 0) break;

    const debtor = currentDebtors[0];
    const creditor = currentCreditors[0];
    const amount = Math.round(Math.abs(debtor.remaining));

    if (amount < 1) break;

    result.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.userName,
      toUserId: creditor.userId,
      toUserName: creditor.userName,
      amount,
    });

    debtor.remaining = 0;        // debtor fully settled in one payment
    creditor.remaining -= amount; // creditor may become a debtor if overpaid
  }

  return result;
}
