"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, Receipt, ArrowRight } from "lucide-react";

interface Participant { userId: string; shareAmount: number }
interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  expenseDate: string;
  createdBy: string;
  participants: Participant[];
}
interface Settlement {
  id: string;
  payerId: string;
  payeeId: string;
  amount: number;
  note: string | null;
  settledAt: string;
}
interface Member { id: string; name: string }

interface ExpenseListProps {
  roomId: string;
  expenses: Expense[];
  settlements: Settlement[];
  members: Member[];
  currentUserId: string;
  currentUserRole: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  RENT: "bg-violet-100 text-violet-700",
  GROCERIES: "bg-green-100 text-green-700",
  UTILITIES: "bg-orange-100 text-orange-700",
  WIFI: "bg-blue-100 text-blue-700",
  OTHER: "bg-gray-100 text-gray-600",
};

type FeedItem =
  | { type: "expense"; data: Expense; date: string }
  | { type: "settlement"; data: Settlement; date: string };

export function ExpenseList({ roomId, expenses, settlements, members, currentUserId, currentUserRole }: ExpenseListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  async function handleDelete(expenseId: string) {
    setDeleting(expenseId);
    try {
      await fetch(`/api/rooms/${roomId}/expenses/${expenseId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  const feed: FeedItem[] = [
    ...expenses.map((e) => ({ type: "expense" as const, data: e, date: e.expenseDate })),
    ...settlements.map((s) => ({ type: "settlement" as const, data: s, date: s.settledAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Receipt className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">No activity yet. Add the first expense!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {feed.map((item) => {
        if (item.type === "expense") {
          const exp = item.data;
          const paidByName = memberMap.get(exp.paidBy) ?? "Unknown";
          const myShare = exp.participants.find((p) => p.userId === currentUserId)?.shareAmount;
          const canDelete = exp.createdBy === currentUserId || currentUserRole === "admin";

          return (
            <div key={`exp-${exp.id}`} className="flex items-center justify-between py-4 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">{exp.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.OTHER}`}>
                    {exp.category}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Paid by <span className="font-medium text-gray-700">{paidByName}</span>
                  {" · "}{formatDate(exp.expenseDate)}
                  {myShare !== undefined && exp.paidBy !== currentUserId && (
                    <span className="ml-1 text-rose-600 font-medium">· Your share: {formatCurrency(myShare)}</span>
                  )}
                  {exp.paidBy === currentUserId && (
                    <span className="ml-1 text-emerald-600 font-medium">· You paid</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold text-gray-900">{formatCurrency(exp.amount)}</span>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-rose-600"
                    onClick={() => handleDelete(exp.id)}
                    disabled={deleting === exp.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        }

        const s = item.data;
        const payerName = memberMap.get(s.payerId) ?? "Unknown";
        const payeeName = memberMap.get(s.payeeId) ?? "Unknown";
        const isMyPayment = s.payerId === currentUserId;
        const isMyReceipt = s.payeeId === currentUserId;

        return (
          <div key={`set-${s.id}`} className="flex items-center justify-between py-4 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-emerald-100 text-emerald-700`}>
                  Settlement
                </span>
                <div className="flex items-center gap-1 text-sm font-medium text-gray-900 truncate">
                  <span>{isMyPayment ? "You" : payerName}</span>
                  <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                  <span>{isMyReceipt ? "You" : payeeName}</span>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(s.settledAt)}
                {s.note && <span className="ml-1">· {s.note}</span>}
                {isMyPayment && <span className="ml-1 text-rose-600 font-medium">· You paid</span>}
                {isMyReceipt && <span className="ml-1 text-emerald-600 font-medium">· You received</span>}
              </div>
            </div>
            <span className="font-semibold text-emerald-600 shrink-0">{formatCurrency(s.amount)}</span>
          </div>
        );
      })}
    </div>
  );
}
