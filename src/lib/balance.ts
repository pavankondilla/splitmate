interface ExpenseRecord {
  id: string;
  paidBy: string;
}

interface ParticipantRecord {
  expenseId: string;
  userId: string;
  shareAmount: number;
}

interface SettlementRecord {
  payerId: string;
  payeeId: string;
  amount: number;
}

interface CreditRecord {
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

  // When another user's credit (owedByUserId=userId) is consumed via auto-credit,
  // it means userId effectively paid that amount — count it as a virtual settlement paid.
  const virtualSettlementsPaid = credits
    .filter((c) => c.owedByUserId === userId)
    .reduce((sum, c) => sum + c.usedCredit, 0);

  const netBalance =
    (totalOwedToUser - settlementsReceived) -
    (totalUserOwes - settlementsPaid - virtualSettlementsPaid);

  return { netBalance, totalOwedToUser, totalUserOwes };
}
