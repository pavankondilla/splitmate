import { randomBytes } from "crypto";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import { logActivity } from "@/repositories/activity-log.repository";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function createRoom(userId: string, name: string) {
  const inviteCode = generateInviteCode();
  const room = await roomRepo.createRoom({ name, inviteCode, createdBy: userId, currency: "INR" });
  await roomRepo.addRoomMember({ roomId: room.id, userId, role: "admin" });
  await logActivity({
    roomId: room.id,
    actorId: userId,
    action: "ROOM_CREATED",
    entityType: "room",
    entityId: room.id,
    metadata: { name },
  });
  return room;
}

export async function getUserRooms(userId: string) {
  const rows = await roomRepo.findRoomsByUserId(userId);
  return rows.map((r) => r.room);
}

export async function getRoomDetail(roomId: string, userId: string) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  const members = await roomRepo.findRoomMembers(roomId);
  const userIds = members.map((m) => m.userId);
  const users = await userRepo.findUsersByIds(userIds);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    room,
    members: members.map((m) => ({ membership: m, user: userMap.get(m.userId)! })),
  };
}

export async function joinRoomByCode(userId: string, inviteCode: string) {
  const room = await roomRepo.findRoomByInviteCode(inviteCode);
  if (!room) throw new NotFoundError("Room");

  if (room.inviteExpiresAt && room.inviteExpiresAt < new Date()) {
    throw new ForbiddenError("Invite code has expired");
  }

  const existing = await roomRepo.findRoomMember(room.id, userId);
  if (existing) throw new ConflictError("Already a member of this room");

  const member = await roomRepo.addRoomMember({ roomId: room.id, userId, role: "member" });
  await logActivity({
    roomId: room.id,
    actorId: userId,
    action: "MEMBER_JOINED",
    entityType: "room",
    entityId: room.id,
    metadata: { userId },
  });
  return member;
}

export async function leaveRoom(roomId: string, userId: string) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership) throw new ForbiddenError();

  await roomRepo.softDeleteRoomMember(roomId, userId);
  await logActivity({
    roomId,
    actorId: userId,
    action: "MEMBER_LEFT",
    entityType: "room",
    entityId: roomId,
    metadata: { userId },
  });
}
