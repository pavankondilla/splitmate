"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

interface Member { id: string; name: string; email: string; role: string; joinedAt: string }
interface Participant { userId: string; shareAmount: number }
interface Expense { id: string; title: string; amount: number; category: string; paidBy: string; expenseDate: string; participants: Participant[] }
interface Settlement { id: string; payerId: string; payeeId: string; amount: number; note: string | null; settledAt: string }

interface MembersViewProps {
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: Array<{ userId: string; userName: string; userAvatar: string | null; netBalance: number }>;
  currentUserId: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

type HistoryItem =
  | { type: "expense_paid"; title: string; amount: number; date: string }
  | { type: "expense_share"; title: string; shareAmount: number; paidByName: string; date: string }
  | { type: "settlement_paid"; toName: string; amount: number; note: string | null; date: string }
  | { type: "settlement_received"; fromName: string; amount: number; note: string | null; date: string };

export function MembersView({ members, expenses, settlements, balances, currentUserId }: MembersViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const balanceMap = new Map(balances.map((b) => [b.userId, b.netBalance]));

  function getMemberHistory(memberId: string): HistoryItem[] {
    const items: HistoryItem[] = [];

    for (const exp of expenses) {
      if (exp.paidBy === memberId) {
        items.push({ type: "expense_paid", title: exp.title, amount: exp.amount, date: exp.expenseDate });
      } else {
        const share = exp.participants.find((p) => p.userId === memberId);
        if (share) {
          items.push({
            type: "expense_share",
            title: exp.title,
            shareAmount: share.shareAmount,
            paidByName: memberMap.get(exp.paidBy) ?? "Unknown",
            date: exp.expenseDate,
          });
        }
      }
    }

    for (const s of settlements) {
      if (s.payerId === memberId) {
        items.push({ type: "settlement_paid", toName: memberMap.get(s.payeeId) ?? "Unknown", amount: s.amount, note: s.note, date: s.settledAt });
      } else if (s.payeeId === memberId) {
        items.push({ type: "settlement_received", fromName: memberMap.get(s.payerId) ?? "Unknown", amount: s.amount, note: s.note, date: s.settledAt });
      }
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const isOpen = selectedId === m.id;
        const history = isOpen ? getMemberHistory(m.id) : [];
        const balance = balanceMap.get(m.id) ?? 0;
        const isYou = m.id === currentUserId;

        return (
          <div key={m.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 py-3 px-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setSelectedId(isOpen ? null : m.id)}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{m.name}</span>
                  {isYou && <span className="text-xs text-gray-400">(you)</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={m.role === "admin" ? "default" : "secondary"} className={m.role === "admin" ? "bg-indigo-600 text-white" : ""}>
                  {m.role}
                </Badge>
                <span className={`text-sm font-semibold ${balance > 0 ? "text-emerald-600" : balance < 0 ? "text-rose-600" : "text-gray-400"}`}>
                  {balance === 0 ? "Settled" : balance > 0 ? `+${formatCurrency(balance)}` : `-${formatCurrency(Math.abs(balance))}`}
                </span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction History</p>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No transactions yet.</p>
                ) : (
                  history.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        {item.type === "expense_paid" && (
                          <>
                            <span className="font-medium text-gray-900">Paid for {item.title}</span>
                            <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
                          </>
                        )}
                        {item.type === "expense_share" && (
                          <>
                            <span className="font-medium text-gray-900">Share of {item.title}</span>
                            <p className="text-xs text-gray-400">{formatDate(item.date)} · paid by {item.paidByName}</p>
                          </>
                        )}
                        {item.type === "settlement_paid" && (
                          <>
                            <div className="flex items-center gap-1 font-medium text-gray-900">
                              <span>Paid</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>{item.toName}</span>
                            </div>
                            <p className="text-xs text-gray-400">{formatDate(item.date)}{item.note ? ` · ${item.note}` : ""}</p>
                          </>
                        )}
                        {item.type === "settlement_received" && (
                          <>
                            <div className="flex items-center gap-1 font-medium text-gray-900">
                              <span>Received from</span>
                              <span>{item.fromName}</span>
                            </div>
                            <p className="text-xs text-gray-400">{formatDate(item.date)}{item.note ? ` · ${item.note}` : ""}</p>
                          </>
                        )}
                      </div>
                      <span className={`font-semibold shrink-0 ${
                        item.type === "expense_paid" ? "text-emerald-600" :
                        item.type === "expense_share" ? "text-rose-600" :
                        item.type === "settlement_paid" ? "text-rose-600" :
                        "text-emerald-600"
                      }`}>
                        {item.type === "expense_paid" && `+${formatCurrency(item.amount)}`}
                        {item.type === "expense_share" && `-${formatCurrency(item.shareAmount)}`}
                        {item.type === "settlement_paid" && `-${formatCurrency(item.amount)}`}
                        {item.type === "settlement_received" && `+${formatCurrency(item.amount)}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
