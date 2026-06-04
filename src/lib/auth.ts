import { auth, currentUser } from "@clerk/nextjs/server";
import { UnauthorizedError } from "./errors";
import { findUserByClerkId, upsertUser } from "@/repositories/user.repository";

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

  let user = await findUserByClerkId(clerkId);
  if (!user) {
    // Webhook may not have fired yet — sync user from Clerk on first access
    const clerkUser = await currentUser();
    if (!clerkUser) throw new UnauthorizedError();
    const primaryEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || primaryEmail;
    user = await upsertUser({
      clerkId,
      email: primaryEmail,
      name,
      avatarUrl: clerkUser.imageUrl ?? null,
    });
  }

  return user;
}
