interface ExpenseRecord {
  id: string;
  paidBy: string;
}

interface ParticipantRecord {
  expenseId: string;
  userId: string;
  shareAmount: number;
  creditApplied: number;
}

interface SettlementRecord {
  payerId: string;
  payeeId: string;
  amount: number;
}

interface CreditRecord {
  userId: string;
  owedByUserId: string;
  usedCredit: number;
}

export function computeNetBalance(
  userId: string,
  expenses: ExpenseRecord[],
  participants: ParticipantRecord[],
  settlements: SettlementRecord[],
  credits: CreditRecord[] = []
): { netBalance: number; totalOwedToUser: number; totalUserOwes: number } {
  const expensePaidByMap = new Map(expenses.map((e) => [e.id, e.paidBy]));

  const totalOwedToUser = participants
    .filter((p) => p.userId !== userId && expensePaidByMap.get(p.expenseId) === userId)
    .reduce((sum, p) => sum + p.shareAmount, 0);

  const totalUserOwes = participants
    .filter((p) => p.userId === userId && expensePaidByMap.get(p.expenseId) !== userId)
    .reduce((sum, p) => sum + p.shareAmount, 0);

  const settlementsReceived = settlements
    .filter((s) => s.payeeId === userId)
    .reduce((sum, s) => sum + s.amount, 0);

  const settlementsPaid = settlements
    .filter((s) => s.payerId === userId)
    .reduce((sum, s) => sum + s.amount, 0);

  // Only the expense-auto-credited portion counts as virtual settlement paid.
  // Settlement-return portion is already in settlementsPaid — don't double-count.
  const expenseCreditUsedByUser = new Map<string, number>();
  for (const p of participants) {
    if (p.creditApplied > 0) {
      expenseCreditUsedByUser.set(p.userId, (expenseCreditUsedByUser.get(p.userId) ?? 0) + p.creditApplied);
    }
  }
  const virtualSettlementsPaid = credits
    .filter((c) => c.owedByUserId === userId)
    .reduce((sum, c) => sum + Math.min(c.usedCredit, expenseCreditUsedByUser.get(c.userId) ?? 0), 0);

  // When a participant's share in an expense paid by userId is covered by auto-credit,
  // userId has effectively received that amount — reduce what they're still owed.
  const virtualReceiptsFromCredits = participants
    .filter((p) => p.userId !== userId && expensePaidByMap.get(p.expenseId) === userId)
    .reduce((sum, p) => sum + p.creditApplied, 0);

  const netBalance =
    (totalOwedToUser - settlementsReceived - virtualReceiptsFromCredits) -
    (totalUserOwes - settlementsPaid - virtualSettlementsPaid);

  return { netBalance, totalOwedToUser, totalUserOwes };
}
