import { ForbiddenError, NotFoundError } from "@/lib/errors";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as proposalRepo from "@/repositories/proposal.repository";
import { logActivity } from "@/repositories/activity-log.repository";
import { detectAndCreateCredit, consumeCreditsOnSettlement } from "@/services/credit.service";

export interface RecordSettlementInput {
  payerId: string;
  payeeId: string;
  amount: number;
  note?: string;
}

export async function recordSettlement(userId: string, roomId: string, data: RecordSettlementInput) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const settlement = await settlementRepo.createSettlement({
    roomId,
    payerId: data.payerId,
    payeeId: data.payeeId,
    amount: data.amount,
    note: data.note ?? null,
    createdBy: userId,
  });

  await logActivity({
    roomId,
    actorId: userId,
    action: "SETTLEMENT_MADE",
    entityType: "settlement",
    entityId: settlement.id,
    metadata: { payerId: data.payerId, payeeId: data.payeeId, amount: data.amount },
  });

  // Auto-detect overpayment and create credit record if applicable
  await detectAndCreateCredit(settlement.id, data.payerId, data.payeeId, roomId);

  // Consume payee's existing credits if payer is returning overpayment
  await consumeCreditsOnSettlement(data.payerId, data.payeeId, data.amount, roomId);

  // Confirm any matching settlement proposals for this pair
  await proposalRepo.confirmProposalsForSettlement(
    roomId, data.payerId, data.payeeId, data.amount, settlement.id
  );

  return settlement;
}

export async function getRoomSettlements(roomId: string, userId: string) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  return settlementRepo.findSettlementsByRoomId(roomId);
}
