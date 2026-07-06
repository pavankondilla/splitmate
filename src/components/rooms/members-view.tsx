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

interface SpendingItem {
  id: string;
  title: string;
  shareAmount: number;
  creditApplied: number;
  paidByName: string;
  paidBySelf: boolean; // this member paid the bill themselves
  expenseTotal: number;
  date: string;
}

interface PaymentItem {
  id: string;
  direction: "paid" | "received";
  otherName: string;
  amount: number;
  note: string | null;
  date: string;
}

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

  // Total spent = sum of the member's shares across all expenses, including
  // their own share of bills they paid and shares covered by credit —
  // credit is still their money (an earlier overpayment), so it counts.
  function getTotalSpent(memberId: string): number {
    return expenses.reduce((sum, exp) => {
      const share = exp.participants.find((p) => p.userId === memberId);
      return sum + (share?.shareAmount ?? 0);
    }, 0);
  }

  function getPaidOutOfPocket(memberId: string): number {
    return expenses
      .filter((exp) => exp.paidBy === memberId)
      .reduce((sum, exp) => sum + exp.amount, 0);
  }

  // One line per expense share, oldest first — every line is the same kind of
  // number, so the section sums exactly to getTotalSpent.
  function getSpending(memberId: string): SpendingItem[] {
    const items: SpendingItem[] = [];
    for (const exp of expenses) {
      const share = exp.participants.find((p) => p.userId === memberId);
      if (!share) continue;
      items.push({
        id: exp.id,
        title: exp.title,
        shareAmount: share.shareAmount,
        creditApplied: share.creditApplied,
        paidByName: memberMap.get(exp.paidBy) ?? "Unknown",
        paidBySelf: exp.paidBy === memberId,
        expenseTotal: exp.amount,
        date: exp.expenseDate,
      });
    }
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  function getPayments(memberId: string): PaymentItem[] {
    const items: PaymentItem[] = [];
    for (const s of settlements) {
      if (s.payerId === memberId) {
        items.push({ id: s.id, direction: "paid", otherName: memberMap.get(s.payeeId) ?? "Unknown", amount: s.amount, note: s.note, date: s.settledAt });
      } else if (s.payeeId === memberId) {
        items.push({ id: s.id, direction: "received", otherName: memberMap.get(s.payerId) ?? "Unknown", amount: s.amount, note: s.note, date: s.settledAt });
      }
    }
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const isOpen = selectedId === m.id;
        const balance = balanceMap.get(m.id) ?? 0;
        const isYou = m.id === currentUserId;
        const totalSpent = getTotalSpent(m.id);
        const spending = isOpen ? getSpending(m.id) : [];
        const payments = isOpen ? getPayments(m.id) : [];

        return (
          <div key={m.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <button
              className="w-full flex items-center gap-3 py-3 px-4 hover:bg-muted/60 transition-colors text-left"
              onClick={() => setSelectedId(isOpen ? null : m.id)}
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700 dark:bg-primary/20 dark:text-indigo-300">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground text-sm truncate">{m.name}</span>
                  {isYou && <span className="text-xs text-muted-foreground shrink-0">(you)</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  Spent {formatCurrency(totalSpent)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={m.role === "admin" ? "default" : "secondary"} className={`hidden sm:inline-flex ${m.role === "admin" ? "bg-primary text-primary-foreground" : ""}`}>
                  {m.role}
                </Badge>
                <span className={`text-sm font-semibold font-money ${balance > 0 ? "text-emerald-600 dark:text-emerald-400" : balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                  {balance === 0 ? "Settled" : balance > 0 ? `+${formatCurrency(balance)}` : `-${formatCurrency(Math.abs(balance))}`}
                </span>
                {!isYou && currentUserRole === "admin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemovingMemberId(m.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 py-3 bg-muted/40 space-y-4">
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>

                {/* ── Summary strip: the anchor numbers ── */}
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-card border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Spent</p>
                    <p className="text-sm font-bold font-money text-foreground truncate">{formatCurrency(totalSpent)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Paid Out of Pocket</p>
                    <p className="text-sm font-bold font-money text-foreground truncate">{formatCurrency(getPaidOutOfPocket(m.id))}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Balance</p>
                    <p className={`text-sm font-bold font-money truncate ${balance > 0 ? "text-emerald-600 dark:text-emerald-400" : balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      {balance === 0 ? "Settled" : balance > 0 ? `+${formatCurrency(balance)}` : `-${formatCurrency(Math.abs(balance))}`}
                    </p>
                  </div>
                </div>

                {/* ── Spending: one line per expense share ── */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Spending</p>
                  {spending.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No expenses yet.</p>
                  ) : (
                    <div className="space-y-0">
                      {spending.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 text-sm py-1.5 border-b border-border/60">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground truncate">{item.title}</span>
                              {item.creditApplied > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Sparkles className="h-3 w-3" />
                                  {item.creditApplied >= item.shareAmount
                                    ? "credit"
                                    : `${formatCurrency(item.creditApplied)} credit`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.date)}
                              {item.paidBySelf
                                ? ` · paid the bill ${formatCurrency(item.expenseTotal)}`
                                : ` · paid by ${item.paidByName}`}
                            </p>
                          </div>
                          <span className="font-semibold font-money text-foreground shrink-0">
                            {formatCurrency(item.shareAmount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2 pt-2 text-sm">
                        <span className="font-semibold text-muted-foreground">Total spent</span>
                        <span className="font-bold font-money text-foreground">{formatCurrency(totalSpent)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Payments: settling up, not spending ── */}
                {payments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payments (settling up)</p>
                    <div className="space-y-0">
                      {payments.map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 text-sm py-1.5 border-b border-border/60 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 font-medium text-foreground min-w-0">
                              {item.direction === "paid" ? (
                                <>
                                  <span className="shrink-0">Paid</span>
                                  <ArrowRight className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{item.otherName}</span>
                                </>
                              ) : (
                                <span className="truncate">Received from {item.otherName}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.date)}{item.note ? ` · ${item.note}` : ""}
                            </p>
                          </div>
                          <span className="font-semibold font-money text-foreground shrink-0">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
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
