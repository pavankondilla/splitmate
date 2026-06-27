import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { getRoomDetail } from "@/services/room.service";
import { getRoomExpenses } from "@/services/expense.service";
import { getRoomBalances, getPairwiseBalances } from "@/services/balance.service";
import { getRoomSettlements } from "@/services/settlement.service";
import { getRoomCredits } from "@/services/credit.service";
import { formatCurrency } from "@/lib/format";
import { RoomTabs } from "@/components/rooms/room-tabs";
import { Badge } from "@/components/ui/badge";
import { ShareInviteButton } from "@/components/rooms/share-invite-button";
import { Download } from "lucide-react";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireDbUser();

  let detail, expenses, balances, pairwise, settlements, credits;
  try {
    [detail, expenses, balances, pairwise, settlements, credits] = await Promise.all([
      getRoomDetail(id, user.id),
      getRoomExpenses(id, user.id),
      getRoomBalances(id, user.id),
      getPairwiseBalances(id, user.id),
      getRoomSettlements(id, user.id),
      getRoomCredits(id, user.id),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const { room, members } = detail;
  const currentMembership = members.find((m) => m.membership.userId === user.id);
  const currentUserRole = currentMembership?.membership.role ?? "member";
  const myBalance = balances.find((b) => b.userId === user.id);

  const memberList = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.membership.role,
    joinedAt: m.membership.joinedAt.toISOString(),
  }));

  const serializedSettlements = settlements.map((s) => ({
    id: s.id,
    payerId: s.payerId,
    payeeId: s.payeeId,
    amount: s.amount,
    note: s.note,
    settledAt: s.settledAt.toISOString(),
    onBehalfOfAmount: s.onBehalfOfAmount,
    onBehalfOfUserId: s.onBehalfOfUserId,
  }));

  return (
    <div className="space-y-6">
      {/* Room header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">Invite code:</span>
            <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800 tracking-widest">
              {room.inviteCode}
            </code>
            <Badge variant="secondary">{room.currency}</Badge>
            <ShareInviteButton inviteCode={room.inviteCode} />
          </div>
        </div>
        <a
          href={`/api/rooms/${room.id}/export`}
          download
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </div>

      {/* Tabs */}
      <RoomTabs
        roomId={room.id}
        roomName={room.name}
        inviteCode={room.inviteCode}
        members={memberList}
        expenses={expenses}
        settlements={serializedSettlements}
        credits={credits}
        balances={balances}
        pairwise={pairwise}
        currentUserId={user.id}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
