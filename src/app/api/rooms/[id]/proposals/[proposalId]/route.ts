import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import * as proposalRepo from "@/repositories/proposal.repository";
import * as roomRepo from "@/repositories/room.repository";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id: roomId, proposalId } = await params;

    const membership = await roomRepo.findRoomMember(roomId, user.id);
    if (!membership) throw new ForbiddenError();

    const proposal = await proposalRepo.findProposalById(proposalId);
    if (!proposal) throw new NotFoundError("Proposal");
    if (proposal.roomId !== roomId) throw new ForbiddenError();

    // Only fromUserId can dismiss their own proposal
    if (proposal.fromUserId !== user.id) throw new ForbiddenError();

    if (proposal.status !== "PROPOSED") {
      return NextResponse.json({ error: "Proposal is no longer pending" }, { status: 409 });
    }

    const updated = await proposalRepo.updateProposalStatus(proposalId, "DISMISSED");
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
