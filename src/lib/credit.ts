// Determines how much of a settlement is a credit return rather than
// payment of normal expense debt.
//
// When a payer settles with a payee, the payment first covers the payer's
// outstanding expense debt to the payee. Only the portion that exceeds that
// debt can be "returning" credit the payee holds (from an earlier
// overpayment). Consuming credits from the full settlement amount would
// silently erase the payee's credit while the balance still shows it owed.
export function computeCreditReturnPortion(
  settlementAmount: number,
  totalEffectiveOwed: number,
  totalPaidIncludingThis: number
): number {
  const surplus = totalPaidIncludingThis - totalEffectiveOwed;
  return Math.max(0, Math.min(settlementAmount, surplus));
}
