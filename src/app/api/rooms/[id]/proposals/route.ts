import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import * as proposalRepo from "@/repositories/proposal.repository";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import { ForbiddenError } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id: roomId } = await params;

    const membership = await roomRepo.findRoomMember(roomId, user.id);
    if (!membership) throw new ForbiddenError();

    // Get all PROPOSED proposals for this room
    const proposals = await proposalRepo.findProposalsByRoom(roomId);
    const pending = proposals.filter((p) => p.status === "PROPOSED");

    // Enrich with user names
    const userIds = [...new Set([
      ...pending.map((p) => p.fromUserId),
      ...pending.map((p) => p.toUserId),
      ...pending.map((p) => p.triggeredByUserId),
    ])];
    const users = await userRepo.findUsersByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const enriched = pending.map((p) => ({
      id: p.id,
      roomId: p.roomId,
      fromUserId: p.fromUserId,
      fromUserName: userMap.get(p.fromUserId) ?? "Unknown",
      toUserId: p.toUserId,
      toUserName: userMap.get(p.toUserId) ?? "Unknown",
      triggeredByUserId: p.triggeredByUserId,
      triggeredByUserName: userMap.get(p.triggeredByUserId) ?? "Unknown",
      amount: p.amount,
      reason: p.reason,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    return apiError(error);
  }
}
