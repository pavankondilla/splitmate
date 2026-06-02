"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseList } from "./expense-list";
import { BalanceView } from "./balance-view";
import { MembersView } from "./members-view";
import { AddExpenseDialog } from "./add-expense-dialog";
import { RecordSettlementDialog } from "./record-settlement-dialog";

interface RoomTabsProps {
  roomId: string;
  members: Array<{ id: string; name: string; email: string; role: string; joinedAt: Date }>;
  expenses: Array<{ id: string; title: string; amount: number; category: string; paidBy: string; expenseDate: string; createdBy: string; participants: Array<{ userId: string; shareAmount: number }> }>;
  balances: Array<{ userId: string; userName: string; userAvatar: string | null; netBalance: number }>;
  pairwise: Array<{ fromUserId: string; fromUserName: string; toUserId: string; toUserName: string; amount: number }>;
  currentUserId: string;
  currentUserRole: string;
}

export function RoomTabs({ roomId, members, expenses, balances, pairwise, currentUserId, currentUserRole }: RoomTabsProps) {
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));

  return (
    <Tabs defaultValue="expenses">
      <div className="flex items-center justify-between mb-4">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <RecordSettlementDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} />
          <AddExpenseDialog roomId={roomId} members={memberOptions} currentUserId={currentUserId} />
        </div>
      </div>

      <TabsContent value="expenses">
        <ExpenseList roomId={roomId} expenses={expenses} members={memberOptions} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      </TabsContent>

      <TabsContent value="balances">
        <BalanceView balances={balances} pairwise={pairwise} currentUserId={currentUserId} />
      </TabsContent>

      <TabsContent value="members">
        <MembersView members={members} currentUserId={currentUserId} />
      </TabsContent>
    </Tabs>
  );
}
