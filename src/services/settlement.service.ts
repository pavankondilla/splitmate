import { ForbiddenError, NotFoundError } from "@/lib/errors";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import { logActivity } from "@/repositories/activity-log.repository";

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

  return settlement;
}

export async function getRoomSettlements(roomId: string, userId: string) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  return settlementRepo.findSettlementsByRoomId(roomId);
}
