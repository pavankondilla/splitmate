"use client";

import { useState } from "react";
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

export function RoomTabs({ roomId, roomName, inviteCode, members, expenses, settlements, credits, balances, pairwise, currentUserId, currentUserRole }: RoomTabsProps) {
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
    <Tabs defaultValue="expenses">
      <div className="flex items-center justify-between mb-4">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="expenses">Activity</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
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
          <RecordSettlementDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} />
          <AddExpenseDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} />
        </div>
      </div>

      <TabsContent value="expenses">
        <ExpenseList roomId={roomId} expenses={expenses} settlements={settlements} credits={credits} members={memberOptions} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      </TabsContent>

      <TabsContent value="balances">
        <BalanceView roomId={roomId} balances={balances} pairwise={pairwise} members={members} currentUserId={currentUserId} expenseCount={expenses.length} />
      </TabsContent>

      <TabsContent value="members">
        <MembersView roomId={roomId} members={members} expenses={expenses} settlements={settlements} balances={balances} currentUserId={currentUserId} currentUserRole={currentUserRole} />
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
