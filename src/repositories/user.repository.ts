import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, type NewUser } from "@/db/schema";

export async function findUserByClerkId(clerkId: string) {
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return result[0] ?? null;
}

export async function findUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function findUsersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}

export async function upsertUser(data: NewUser) {
  const result = await db
    .insert(users)
    .values(data)
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result[0];
}

export async function updateUser(id: string, data: Partial<Pick<NewUser, "email" | "name" | "avatarUrl">>) {
  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0] ?? null;
}
