import { ForbiddenError, NotFoundError } from "@/lib/errors";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import * as proposalRepo from "@/repositories/proposal.repository";
import { logActivity } from "@/repositories/activity-log.repository";
import { detectAndCreateCredit, consumeCreditsOnSettlement, confirmProposalsForSettlement } from "@/services/credit.service";
import { sendSettlementEmail } from "@/lib/email";

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

  // All post-settlement hooks are best-effort: a failure must not roll back
  // the already-recorded settlement. Balances derive from raw ledger data and
  // stay correct regardless of hook outcomes.
  const runHook = async (name: string, hook: () => Promise<unknown>) => {
    try {
      await hook();
    } catch (err) {
      console.error(`[settlement ${settlement.id}] credit hook "${name}" failed:`, err);
    }
  };

  // Auto-detect overpayment and create credit record if applicable
  await runHook("detectAndCreateCredit", () =>
    detectAndCreateCredit(settlement.id, data.payerId, data.payeeId, roomId)
  );

  // Consume payee's existing credits if payer is returning overpayment
  await runHook("consumeCreditsOnSettlement", () =>
    consumeCreditsOnSettlement(data.payerId, data.payeeId, data.amount, roomId)
  );

  // Confirm matching proposals and update credit/participant status
  await runHook("confirmProposalsForSettlement", () =>
    confirmProposalsForSettlement(roomId, data.payerId, data.payeeId, data.amount, settlement.id)
  );

  // Notify payee by email
  await runHook("sendSettlementEmail", async () => {
    const [payer, payee] = await Promise.all([
      userRepo.findUserById(data.payerId),
      userRepo.findUserById(data.payeeId),
    ]);
    if (payee?.email) {
      await sendSettlementEmail({
        roomId,
        roomName: room.name,
        payerName: payer?.name ?? "Someone",
        amount: data.amount,
        payeeEmail: payee.email,
        payeeName: payee.name,
        note: data.note,
      });
    }
  });

  return settlement;
}

export async function getRoomSettlements(roomId: string, userId: string) {
  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const settlements = await settlementRepo.findSettlementsByRoomId(roomId);

  // Annotate each settlement with the portion that confirmed a proposal —
  // that part was paid on behalf of someone else's credit, not the payer's
  // own debt. The UI needs this to attribute shares and label the payment.
  const confirmedProposals = await proposalRepo.findConfirmedProposalsByRoom(roomId);
  const proposalsBySettlement = new Map<string, { amount: number; onBehalfOfUserId: string | null }>();
  for (const pr of confirmedProposals) {
    if (!pr.confirmedSettlementId) continue;
    const existing = proposalsBySettlement.get(pr.confirmedSettlementId);
    proposalsBySettlement.set(pr.confirmedSettlementId, {
      amount: (existing?.amount ?? 0) + pr.amount,
      onBehalfOfUserId: existing?.onBehalfOfUserId ?? pr.triggeredByUserId,
    });
  }

  return settlements.map((s) => {
    const proposal = proposalsBySettlement.get(s.id);
    return {
      ...s,
      onBehalfOfAmount: proposal?.amount ?? 0,
      onBehalfOfUserId: proposal?.onBehalfOfUserId ?? null,
    };
  });
}
