import { randomBytes } from "crypto";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import * as roomRepo from "@/repositories/room.repository";
import * as userRepo from "@/repositories/user.repository";
import { logActivity } from "@/repositories/activity-log.repository";
import { getRoomBalances } from "@/services/balance.service";

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
  return { member, roomId: room.id };
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

export async function renameRoom(roomId: string, userId: string, name: string) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership || membership.role !== "admin") throw new ForbiddenError("Only admins can rename a room");

  const updated = await roomRepo.updateRoom(roomId, { name });
  await logActivity({
    roomId,
    actorId: userId,
    action: "ROOM_RENAMED",
    entityType: "room",
    entityId: roomId,
    metadata: { oldName: room.name, newName: name },
  });
  return updated;
}

export async function regenerateInviteCode(roomId: string, userId: string) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership || membership.role !== "admin") throw new ForbiddenError("Only admins can regenerate the invite code");

  const inviteCode = generateInviteCode();
  const updated = await roomRepo.updateRoom(roomId, { inviteCode });
  await logActivity({
    roomId,
    actorId: userId,
    action: "INVITE_CODE_REGENERATED",
    entityType: "room",
    entityId: roomId,
    metadata: {},
  });
  return updated;
}

export async function deleteRoom(roomId: string, userId: string) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const membership = await roomRepo.findRoomMember(roomId, userId);
  if (!membership || membership.role !== "admin") throw new ForbiddenError("Only admins can delete a room");

  await roomRepo.softDeleteRoom(roomId);
  await logActivity({
    roomId,
    actorId: userId,
    action: "ROOM_DELETED",
    entityType: "room",
    entityId: roomId,
    metadata: { name: room.name },
  });
}

export async function removeMember(roomId: string, memberIdToRemove: string, adminUserId: string) {
  const room = await roomRepo.findRoomById(roomId);
  if (!room) throw new NotFoundError("Room");

  const adminMembership = await roomRepo.findRoomMember(roomId, adminUserId);
  if (!adminMembership || adminMembership.role !== "admin") throw new ForbiddenError("Only admins can remove members");

  if (adminUserId === memberIdToRemove) throw new ConflictError("Cannot remove yourself");

  const memberToRemove = await roomRepo.findRoomMember(roomId, memberIdToRemove);
  if (!memberToRemove) throw new NotFoundError("Member");

  const balances = await getRoomBalances(roomId, memberIdToRemove);
  const memberBalance = balances.find((b) => b.userId === memberIdToRemove);
  if (memberBalance && memberBalance.netBalance < 0) {
    throw new ConflictError("Member must settle debts before removal");
  }

  const memberUser = await userRepo.findUserById(memberIdToRemove);
  await roomRepo.removeRoomMember(roomId, memberIdToRemove, adminUserId);

  await logActivity({
    roomId,
    actorId: adminUserId,
    action: "MEMBER_REMOVED",
    entityType: "room",
    entityId: roomId,
    metadata: {
      removedMemberId: memberIdToRemove,
      removedMemberName: memberUser?.name ?? "Unknown",
      removedMemberEmail: memberUser?.email ?? "Unknown",
    },
  });
}
