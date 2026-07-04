"use client";

import { useOptimistic, useState } from "react";
import { Trash2, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ExpenseList } from "./expense-list";
import { BalanceView } from "./balance-view";
import { MembersView } from "./members-view";
import { AddExpenseDialog } from "./add-expense-dialog";
import { RecordSettlementDialog } from "./record-settlement-dialog";
import { DeleteRoomDialog } from "./delete-room-dialog";
import { RoomSettingsDialog } from "./room-settings-dialog";

type Settlement = {
  id: string;
  payerId: string;
  payeeId: string;
  amount: number;
  note: string | null;
  settledAt: string;
  onBehalfOfAmount: number;
  onBehalfOfUserId: string | null;
};
type Expense = { id: string; title: string; amount: number; category: string; paidBy: string; expenseDate: string; notes: string | null; createdAt: string | Date; createdBy: string; participants: Array<{ id: string; userId: string; shareAmount: number; creditApplied: number; creditConfirmed: boolean }> };
type Member = { id: string; name: string; email: string; role: string; joinedAt: string };
type Credit = {
  id: string;
  userId: string;
  owedByUserId: string;
  totalCredit: number;
  usedCredit: number;
  isExhausted: boolean;
  status: string;
};

interface RoomTabsProps {
  roomId: string;
  roomName: string;
  inviteCode: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  credits: Credit[];
  balances: Array<{ userId: string; userName: string; userAvatar: string | null; netBalance: number }>;
  pairwise: Array<{ fromUserId: string; fromUserName: string; toUserId: string; toUserName: string; amount: number }>;
  currentUserId: string;
  currentUserRole: string;
}

type ExpenseAction = { type: "add"; expense: Expense } | { type: "remove"; id: string };

export function RoomTabs({ roomId, roomName, inviteCode, members, expenses, settlements, credits, balances, pairwise, currentUserId, currentUserRole }: RoomTabsProps) {
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Optimistic view of the ledger lists: a just-added expense/settlement (or a
  // just-deleted expense) shows instantly, then reconciles when the transition
  // wrapping router.refresh() lands fresh server data. Balances and pairwise
  // stay server-computed — never recomputed optimistically (ledger rule).
  const [optimisticExpenses, applyExpenseAction] = useOptimistic(
    expenses,
    (state: Expense[], action: ExpenseAction) =>
      action.type === "add" ? [action.expense, ...state] : state.filter((e) => e.id !== action.id)
  );
  const [optimisticSettlements, addOptimisticSettlement] = useOptimistic(
    settlements,
    (state: Settlement[], s: Settlement) => [s, ...state]
  );

  return (
    <>
    <Tabs defaultValue="balances">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <TabsList className="bg-gray-100 w-full sm:w-auto">
          <TabsTrigger value="balances" className="flex-1 sm:flex-none">Balances</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 sm:flex-none">Activity</TabsTrigger>
          <TabsTrigger value="members" className="flex-1 sm:flex-none">Members</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
          {currentUserRole === "admin" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete Room</span>
              </Button>
            </>
          )}
          <RecordSettlementDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} onOptimisticRecord={addOptimisticSettlement} />
          <AddExpenseDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} onOptimisticAdd={(expense) => applyExpenseAction({ type: "add", expense })} />
        </div>
      </div>

      <TabsContent value="expenses">
        <ExpenseList roomId={roomId} expenses={optimisticExpenses} settlements={optimisticSettlements} credits={credits} members={memberOptions} currentUserId={currentUserId} currentUserRole={currentUserRole} onExpenseRemoved={(id) => applyExpenseAction({ type: "remove", id })} onExpenseAdded={(expense) => applyExpenseAction({ type: "add", expense })} />
      </TabsContent>

      <TabsContent value="balances">
        <BalanceView roomId={roomId} balances={balances} pairwise={pairwise} members={members} currentUserId={currentUserId} expenseCount={optimisticExpenses.length} onOptimisticSettlement={addOptimisticSettlement} />
      </TabsContent>

      <TabsContent value="members">
        <MembersView roomId={roomId} members={members} expenses={optimisticExpenses} settlements={optimisticSettlements} balances={balances} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      </TabsContent>
    </Tabs>

    <DeleteRoomDialog
      roomId={roomId}
      roomName={roomName}
      memberCount={members.length}
      expenseCount={expenses.length}
      isOpen={deleteOpen}
      onOpenChange={setDeleteOpen}
    />
    <RoomSettingsDialog
      roomId={roomId}
      roomName={roomName}
      inviteCode={inviteCode}
      isOpen={settingsOpen}
      onOpenChange={setSettingsOpen}
    />
    </>
  );
}
