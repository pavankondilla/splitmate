export function calculateEqualShares(
  totalAmount: number,
  participantIds: string[]
): Array<{ userId: string; shareAmount: number }> {
  const count = participantIds.length;
  const baseShare = Math.floor(totalAmount / count);
  const remainder = totalAmount - baseShare * count;

  return participantIds.map((userId, i) => ({
    userId,
    shareAmount: i === 0 ? baseShare + remainder : baseShare,
  }));
}
