"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "./expense-list";
import { BalanceView } from "./balance-view";
import { MembersView } from "./members-view";
import { AddExpenseDialog } from "./add-expense-dialog";
import { RecordSettlementDialog } from "./record-settlement-dialog";

type Settlement = { id: string; payerId: string; payeeId: string; amount: number; note: string | null; settledAt: string };
type Expense = { id: string; title: string; amount: number; category: string; paidBy: string; expenseDate: string; createdBy: string; participants: Array<{ id: string; userId: string; shareAmount: number; creditApplied: number; creditConfirmed: boolean }> };
type Member = { id: string; name: string; email: string; role: string; joinedAt: string };

interface RoomTabsProps {
  roomId: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: Array<{ userId: string; userName: string; userAvatar: string | null; netBalance: number }>;
  pairwise: Array<{ fromUserId: string; fromUserName: string; toUserId: string; toUserName: string; amount: number }>;
  currentUserId: string;
  currentUserRole: string;
}

export function RoomTabs({ roomId, members, expenses, settlements, balances, pairwise, currentUserId, currentUserRole }: RoomTabsProps) {
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));

  return (
    <Tabs defaultValue="balances">
      <div className="flex items-center justify-between mb-4">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="expenses">Activity</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <RecordSettlementDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} />
          <AddExpenseDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} />
        </div>
      </div>

      <TabsContent value="expenses">
        <ExpenseList roomId={roomId} expenses={expenses} settlements={settlements} members={memberOptions} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      </TabsContent>

      <TabsContent value="balances">
        <BalanceView roomId={roomId} balances={balances} pairwise={pairwise} members={members} currentUserId={currentUserId} />
      </TabsContent>

      <TabsContent value="members">
        <MembersView roomId={roomId} members={members} expenses={expenses} settlements={settlements} balances={balances} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      </TabsContent>
    </Tabs>
  );
}
