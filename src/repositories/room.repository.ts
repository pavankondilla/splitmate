import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { rooms, roomMembers, type NewRoom, type NewRoomMember } from "@/db/schema";

export async function createRoom(data: NewRoom) {
  const result = await db.insert(rooms).values(data).returning();
  return result[0];
}

export async function findRoomById(id: string) {
  const result = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, id), isNull(rooms.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function findRoomByInviteCode(inviteCode: string) {
  const result = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.inviteCode, inviteCode), isNull(rooms.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function findRoomsByUserId(userId: string) {
  return db
    .select({ room: rooms })
    .from(rooms)
    .innerJoin(
      roomMembers,
      and(eq(roomMembers.roomId, rooms.id), isNull(roomMembers.deletedAt))
    )
    .where(and(eq(roomMembers.userId, userId), isNull(rooms.deletedAt)));
}

export async function updateRoom(id: string, data: Partial<Pick<NewRoom, "name" | "inviteCode" | "inviteExpiresAt">>) {
  const result = await db
    .update(rooms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(rooms.id, id))
    .returning();
  return result[0] ?? null;
}

export async function softDeleteRoom(id: string) {
  const result = await db
    .update(rooms)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(rooms.id, id))
    .returning();
  return result[0] ?? null;
}

export async function addRoomMember(data: NewRoomMember) {
  const result = await db.insert(roomMembers).values(data).returning();
  return result[0];
}

export async function findRoomMember(roomId: string, userId: string) {
  const result = await db
    .select()
    .from(roomMembers)
    .where(
      and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId), isNull(roomMembers.deletedAt))
    )
    .limit(1);
  return result[0] ?? null;
}

export async function findRoomMembers(roomId: string) {
  return db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.deletedAt)));
}

export async function softDeleteRoomMember(roomId: string, userId: string) {
  const result = await db
    .update(roomMembers)
    .set({ deletedAt: new Date() })
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .returning();
  return result[0] ?? null;
}

export async function removeRoomMember(roomId: string, userId: string, removedByUserId: string) {
  const result = await db
    .update(roomMembers)
    .set({ deletedAt: new Date(), removedBy: removedByUserId })
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .returning();
  return result[0] ?? null;
}
