import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { getRoomDetail } from "@/services/room.service";
import { getRoomExpenses } from "@/services/expense.service";
import { getRoomBalances, getPairwiseBalances } from "@/services/balance.service";
import { formatCurrency } from "@/lib/format";
import { RoomTabs } from "@/components/rooms/room-tabs";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireDbUser();

  let detail, expenses, balances, pairwise;
  try {
    [detail, expenses, balances, pairwise] = await Promise.all([
      getRoomDetail(id, user.id),
      getRoomExpenses(id, user.id),
      getRoomBalances(id, user.id),
      getPairwiseBalances(id, user.id),
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
    joinedAt: m.membership.joinedAt,
  }));

  return (
    <div className="space-y-6">
      {/* Room header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-500">Invite code:</span>
            <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800 tracking-widest">
              {room.inviteCode}
            </code>
            <Badge variant="secondary">{room.currency}</Badge>
          </div>
        </div>
        {myBalance && (
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Your balance</p>
            <p className={`text-xl font-bold ${myBalance.netBalance > 0 ? "text-emerald-600" : myBalance.netBalance < 0 ? "text-rose-600" : "text-gray-400"}`}>
              {myBalance.netBalance === 0
                ? "Settled"
                : myBalance.netBalance > 0
                ? `+${formatCurrency(myBalance.netBalance)}`
                : `-${formatCurrency(Math.abs(myBalance.netBalance))}`}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <RoomTabs
        roomId={room.id}
        members={memberList}
        expenses={expenses}
        balances={balances}
        pairwise={pairwise}
        currentUserId={user.id}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
