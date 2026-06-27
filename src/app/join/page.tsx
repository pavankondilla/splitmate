import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Wallet, LogIn, UserPlus, LinkIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireDbUser } from "@/lib/auth";
import { joinRoomByCode } from "@/services/room.service";
import { findRoomByInviteCode } from "@/repositories/room.repository";
import { ConflictError, NotFoundError, ForbiddenError } from "@/lib/errors";

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const { code } = await searchParams;

  if (!code || code.length !== 8) {
    redirect("/");
  }

  const upperCode = code.toUpperCase();
  const { userId: clerkId } = await auth();

  // ── Unauthenticated — show sign-in/sign-up prompt ──────────────────────
  if (!clerkId) {
    const returnUrl = `/join?code=${upperCode}`;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="flex items-center justify-center gap-2 font-semibold text-gray-900">
            <Wallet className="h-5 w-5 text-indigo-600" />
            SplitMate
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-5">
            <div className="h-14 w-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
              <LinkIcon className="h-6 w-6 text-indigo-600" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-gray-900">You&apos;ve been invited!</h1>
              <p className="text-sm text-gray-500 mt-1">
                Sign in or create an account to join the room.
              </p>
            </div>

            <div className="space-y-2.5">
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`} className="block">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In &amp; Join
                </Button>
              </Link>
              <Link href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`} className="block">
                <Button variant="outline" className="w-full gap-2">
                  <UserPlus className="h-4 w-4" />
                  Create Account &amp; Join
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Already signed in?{" "}
            <Link href="/dashboard" className="underline">Go to dashboard</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Authenticated — auto-join and redirect ──────────────────────────────
  const user = await requireDbUser();
  let targetRoomId: string | null = null;
  let errorKind: "not_found" | "expired" | "error" | null = null;

  try {
    const { roomId } = await joinRoomByCode(user.id, upperCode);
    targetRoomId = roomId;
  } catch (err) {
    if (err instanceof ConflictError) {
      // Already a member — find the room to redirect there
      const room = await findRoomByInviteCode(upperCode);
      if (room) targetRoomId = room.id;
      else errorKind = "not_found";
    } else if (err instanceof NotFoundError) {
      errorKind = "not_found";
    } else if (err instanceof ForbiddenError) {
      errorKind = "expired";
    } else {
      errorKind = "error";
    }
  }

  if (targetRoomId) {
    redirect(`/rooms/${targetRoomId}`);
  }

  const errorMessages = {
    not_found: { title: "Link not found", body: "This invite link doesn't exist or the room has been deleted." },
    expired:   { title: "Link expired",   body: "This invite link has expired. Ask the room admin to generate a new one." },
    error:     { title: "Something went wrong", body: "We couldn't process this invite link. Please try again." },
  };
  const msg = errorMessages[errorKind ?? "error"];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-2 font-semibold text-gray-900">
          <Wallet className="h-5 w-5 text-indigo-600" />
          SplitMate
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-5">
          <div className="h-14 w-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{msg.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{msg.body}</p>
          </div>
          <Link href="/dashboard">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
