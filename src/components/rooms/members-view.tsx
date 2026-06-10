"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowRight, ChevronDown, ChevronUp, Trash2, Sparkles } from "lucide-react";
import { RemoveRoomMemberDialog } from "./remove-room-member-dialog";

interface Member { id: string; name: string; email: string; role: string; joinedAt: string }
interface Participant { id: string; userId: string; shareAmount: number; creditApplied: number }
interface Expense { id: string; title: string; amount: number; category: string; paidBy: string; expenseDate: string; participants: Participant[] }
interface Settlement { id: string; payerId: string; payeeId: string; amount: number; note: string | null; settledAt: string }

interface MembersViewProps {
  roomId: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: Array<{ userId: string; userName: string; userAvatar: string | null; netBalance: number }>;
  currentUserId: string;
  currentUserRole: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

type HistoryItem =
  | { type: "expense_paid"; title: string; amount: number; date: string }
  | { type: "expense_share"; title: string; shareAmount: number; creditApplied: number; paidByName: string; date: string }
  | { type: "settlement_paid"; toName: string; amount: number; note: string | null; date: string }
  | { type: "settlement_received"; fromName: string; amount: number; note: string | null; date: string };

export function MembersView({ roomId, members, expenses, settlements, balances, currentUserId, currentUserRole }: MembersViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const balanceMap = new Map(balances.map((b) => [b.userId, b.netBalance]));

  function getUnsettledExpensesCount(memberId: string): number {
    return expenses.filter((exp) => {
      const participant = exp.participants.find((p) => p.userId === memberId);
      if (!participant) return false;

      const settlement = settlements.find((s) =>
        (s.payerId === memberId && s.payeeId === exp.paidBy) ||
        (s.payeeId === memberId && s.payerId === exp.paidBy)
      );

      return !settlement || settlement.amount < participant.shareAmount;
    }).length;
  }

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
            creditApplied: share.creditApplied,
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
                {!isYou && currentUserRole === "admin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-rose-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemovingMemberId(m.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction History</p>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No transactions yet.</p>
                ) : (
                  <>
                  {history.map((item, i) => (
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-gray-900">Share of {item.title}</span>
                              {item.creditApplied > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                  <Sparkles className="h-3 w-3" /> Auto-credited
                                </span>
                              )}
                            </div>
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
                        {item.type === "expense_share" && (
                          item.creditApplied > 0
                            ? <span className="text-blue-500">✦ {formatCurrency(item.creditApplied)}</span>
                            : `-${formatCurrency(item.shareAmount)}`
                        )}
                        {item.type === "settlement_paid" && `-${formatCurrency(item.amount)}`}
                        {item.type === "settlement_received" && `+${formatCurrency(item.amount)}`}
                      </span>
                    </div>
                  ))}
                  {/* Credit summary at bottom of history */}
                  {(() => {
                    const totalCredited = history
                      .filter((h) => h.type === "expense_share" && h.creditApplied > 0)
                      .reduce((sum, h) => sum + (h.type === "expense_share" ? h.creditApplied : 0), 0);
                    if (totalCredited === 0) return null;
                    return (
                      <div className="mt-2 pt-2 border-t border-blue-100 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-blue-500 font-semibold">
                          <Sparkles className="h-3 w-3" /> Total auto-credited
                        </span>
                        <span className="font-bold text-blue-600">{formatCurrency(totalCredited)}</span>
                      </div>
                    );
                  })()}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {removingMemberId && (
        <RemoveRoomMemberDialog
          roomId={roomId}
          memberId={removingMemberId}
          memberName={memberMap.get(removingMemberId) ?? "Unknown"}
          memberBalance={balanceMap.get(removingMemberId) ?? 0}
          unsettledCount={getUnsettledExpensesCount(removingMemberId)}
          isOpen={!!removingMemberId}
          onOpenChange={(open) => !open && setRemovingMemberId(null)}
        />
      )}
    </div>
  );
}
