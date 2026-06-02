"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, Receipt } from "lucide-react";

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
interface Member { id: string; name: string }

interface ExpenseListProps {
  roomId: string;
  expenses: Expense[];
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

export function ExpenseList({ roomId, expenses, members, currentUserId, currentUserRole }: ExpenseListProps) {
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

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Receipt className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">No expenses yet. Add the first one!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {expenses.map((exp) => {
        const paidByName = memberMap.get(exp.paidBy) ?? "Unknown";
        const myShare = exp.participants.find((p) => p.userId === currentUserId)?.shareAmount;
        const canDelete = exp.createdBy === currentUserId || currentUserRole === "admin";

        return (
          <div key={exp.id} className="flex items-center justify-between py-4 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 truncate">{exp.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.OTHER}`}>
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
      })}
    </div>
  );
}
