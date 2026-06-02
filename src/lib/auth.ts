import { auth, currentUser } from "@clerk/nextjs/server";
import { UnauthorizedError, NotFoundError } from "./errors";
import { findUserByClerkId } from "@/repositories/user.repository";

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export async function getAuthUser() {
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireDbUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new UnauthorizedError();
  const user = await findUserByClerkId(clerkId);
  if (!user) throw new NotFoundError("User account not found — please sign in again");
  return user;
}
