import { requireDbUser } from "@/lib/auth";
import { getDashboard } from "@/services/dashboard.service";
import { RoomCard } from "@/components/dashboard/room-card";
import { CreateRoomDialog } from "@/components/dashboard/create-room-dialog";
import { JoinRoomDialog } from "@/components/dashboard/join-room-dialog";
import { formatCurrency } from "@/lib/format";
import { Home } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireDbUser();
  const summary = await getDashboard(user.id);

  const isPositive = summary.totalNetBalance > 0;
  const isNeutral = summary.totalNetBalance === 0;

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isNeutral
              ? "You're all settled up across all rooms."
              : isPositive
              ? `Overall you are owed ${formatCurrency(summary.totalNetBalance)}`
              : `Overall you owe ${formatCurrency(Math.abs(summary.totalNetBalance))}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <JoinRoomDialog />
          <CreateRoomDialog />
        </div>
      </div>

      {/* Rooms grid */}
      {summary.rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Home className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">No rooms yet</h2>
          <p className="text-gray-500 text-sm">Create a room or join one with an invite code.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.rooms.map((r) => (
            <RoomCard
              key={r.id}
              id={r.id}
              name={r.name}
              memberCount={r.memberCount}
              expenseCount={r.expenseCount}
              myNetBalance={r.myNetBalance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
