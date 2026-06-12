import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { settlementProposals, type NewSettlementProposal } from "@/db/schema";

export async function createProposal(data: NewSettlementProposal) {
  const result = await db.insert(settlementProposals).values(data).returning();
  return result[0];
}

export async function findProposalsByRoom(roomId: string) {
  return db
    .select()
    .from(settlementProposals)
    .where(eq(settlementProposals.roomId, roomId));
}

export async function findPendingProposalsForUser(roomId: string, userId: string) {
  return db
    .select()
    .from(settlementProposals)
    .where(
      and(
        eq(settlementProposals.roomId, roomId),
        eq(settlementProposals.fromUserId, userId),
        eq(settlementProposals.status, "PROPOSED")
      )
    );
}

export async function findPendingProposalsByPair(
  roomId: string,
  fromUserId: string,
  toUserId: string
) {
  return db
    .select()
    .from(settlementProposals)
    .where(
      and(
        eq(settlementProposals.roomId, roomId),
        eq(settlementProposals.fromUserId, fromUserId),
        eq(settlementProposals.toUserId, toUserId),
        eq(settlementProposals.status, "PROPOSED")
      )
    );
}

export async function updateProposalStatus(
  proposalId: string,
  status: "CONFIRMED" | "DISMISSED",
  confirmedSettlementId?: string
) {
  const result = await db
    .update(settlementProposals)
    .set({
      status,
      confirmedSettlementId: confirmedSettlementId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(settlementProposals.id, proposalId))
    .returning();
  return result[0];
}

export async function findProposalById(proposalId: string) {
  const result = await db
    .select()
    .from(settlementProposals)
    .where(eq(settlementProposals.id, proposalId))
    .limit(1);
  return result[0] ?? null;
}

// Returns proposals covered by the settlement amount (for service to process)
export async function getProposalsToConfirm(
  roomId: string,
  payerId: string,
  payeeId: string,
  settlementAmount: number
) {
  const proposals = await findPendingProposalsByPair(roomId, payerId, payeeId);
  const toConfirm = [];
  let remaining = settlementAmount;
  for (const proposal of proposals) {
    if (remaining <= 0) break;
    if (proposal.amount <= remaining) {
      toConfirm.push(proposal);
      remaining -= proposal.amount;
    }
  }
  return toConfirm;
}
