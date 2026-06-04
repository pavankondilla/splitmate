import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { upsertUser } from "@/repositories/user.repository";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  await upsertUser({
    clerkId: user.id,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    name:
      (`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()) ||
      (user.emailAddresses[0]?.emailAddress ?? "User"),
    avatarUrl: user.imageUrl ?? null,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
