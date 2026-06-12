interface ExpenseRecord {
  id: string;
  paidBy: string;
}

interface ParticipantRecord {
  id?: string;
  expenseId: string;
  userId: string;
  shareAmount: number;
  creditApplied: number;
  creditConfirmed: boolean;
}

interface SettlementRecord {
  payerId: string;
  payeeId: string;
  amount: number;
}

interface CreditRecord {
  id?: string;
  userId: string;
  owedByUserId: string;
  usedCredit: number;
  status: string;
}

// A confirmed settlement proposal: a real settlement row exists that moved
// this amount on behalf of a credit (debtor paid the expense payer directly).
interface ConfirmedProposalRecord {
  sourceCreditId: string | null;
  participantId: string | null;
  amount: number;
}

export function computeNetBalance(
  userId: string,
  expenses: ExpenseRecord[],
  participants: ParticipantRecord[],
  settlements: SettlementRecord[],
  credits: CreditRecord[] = [],
  confirmedProposals: ConfirmedProposalRecord[] = []
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

  // Proposal-covered amounts: a real settlement row already moved this money
  // (debtor → expense payer), so it is counted via settlementsPaid/Received.
  // Counting it again through the virtual adjustments would double-count —
  // virtuals must only cover the instant path, where no settlement row exists.
  const proposalAmountByParticipant = new Map<string, number>();
  const proposalAmountByCredit = new Map<string, number>();
  for (const pr of confirmedProposals) {
    if (pr.participantId) {
      proposalAmountByParticipant.set(
        pr.participantId,
        (proposalAmountByParticipant.get(pr.participantId) ?? 0) + pr.amount
      );
    }
    if (pr.sourceCreditId) {
      proposalAmountByCredit.set(
        pr.sourceCreditId,
        (proposalAmountByCredit.get(pr.sourceCreditId) ?? 0) + pr.amount
      );
    }
  }

  // Only SETTLED credits count as virtual settlement paid.
  // PENDING_SETTLEMENT credits are not yet finalized — don't count until proposal is confirmed.
  // Settlement-return portion is already in settlementsPaid — don't double-count.
  const expenseCreditUsedByUser = new Map<string, number>();
  for (const p of participants) {
    if (p.creditApplied > 0 && p.creditConfirmed) {
      expenseCreditUsedByUser.set(p.userId, (expenseCreditUsedByUser.get(p.userId) ?? 0) + p.creditApplied);
    }
  }
  const virtualSettlementsPaid = credits
    .filter((c) => c.owedByUserId === userId && c.status === "SETTLED")
    .reduce((sum, c) => {
      const autoUsed = Math.min(c.usedCredit, expenseCreditUsedByUser.get(c.userId) ?? 0);
      const proposalCovered = c.id ? proposalAmountByCredit.get(c.id) ?? 0 : 0;
      return sum + Math.max(0, autoUsed - proposalCovered);
    }, 0);

  // Only count confirmed auto-credits as virtual receipts for the expense payer.
  // Pending credits haven't been settled yet — payer is still owed that money.
  const virtualReceiptsFromCredits = participants
    .filter((p) => p.userId !== userId && expensePaidByMap.get(p.expenseId) === userId && p.creditConfirmed)
    .reduce((sum, p) => {
      const proposalCovered = p.id ? proposalAmountByParticipant.get(p.id) ?? 0 : 0;
      return sum + Math.max(0, p.creditApplied - proposalCovered);
    }, 0);

  const netBalance =
    (totalOwedToUser - settlementsReceived - virtualReceiptsFromCredits) -
    (totalUserOwes - settlementsPaid - virtualSettlementsPaid);

  return { netBalance, totalOwedToUser, totalUserOwes };
}
