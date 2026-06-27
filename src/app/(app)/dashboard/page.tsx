import { requireDbUser } from "@/lib/auth";
import { getDashboard } from "@/services/dashboard.service";
import { RoomCard } from "@/components/dashboard/room-card";
import { CreateRoomDialog } from "@/components/dashboard/create-room-dialog";
import { JoinRoomDialog } from "@/components/dashboard/join-room-dialog";
import { formatCurrency } from "@/lib/format";
import { Home, PlusCircle, Receipt, CheckCircle2 } from "lucide-react";

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
        <div className="max-w-lg mx-auto">
          {/* Welcome banner */}
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to SplitMate!</h2>
            <p className="text-gray-500 text-sm">Get started in 3 simple steps.</p>
          </div>

          {/* 3-step guide */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 mb-6">
            {[
              {
                icon: PlusCircle,
                color: "text-indigo-600",
                bg: "bg-indigo-50",
                step: "1",
                title: "Create or join a room",
                desc: "A room is your shared space — one per flat or group. Invite roommates with a link.",
              },
              {
                icon: Receipt,
                color: "text-violet-600",
                bg: "bg-violet-50",
                step: "2",
                title: "Log expenses together",
                desc: "Add rent, groceries, WiFi, and utilities. SplitMate splits them equally and tracks who paid.",
              },
              {
                icon: CheckCircle2,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                step: "3",
                title: "Settle up",
                desc: "See live balances — who owes whom and how much. Record payments to clear debts.",
              },
            ].map(({ icon: Icon, color, bg, step, title, desc }) => (
              <div key={step} className="flex items-start gap-4 p-5">
                <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Step {step}</p>
                  <p className="font-semibold text-gray-900 text-sm">{title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <CreateRoomDialog />
            <JoinRoomDialog />
          </div>
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
