"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, ChevronDown, ChevronUp, CheckCircle2, Clock, Sparkles, Receipt, ArrowRight, Wallet } from "lucide-react";

interface Participant { id: string; userId: string; shareAmount: number; creditApplied: number; creditConfirmed: boolean }
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
  // Portion of this settlement that confirmed a proposal — paid on behalf of
  // someone else's credit, so it must not count toward the payer's own shares.
  onBehalfOfAmount: number;
  onBehalfOfUserId: string | null;
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

type ParticipantStatus =
  | { kind: "PENDING" }
  | { kind: "SETTLED"; remainingCredit?: number }   // remainingCredit > 0 when participant overpaid
  | { kind: "AUTO_CREDIT"; remainingCredit: number }; // covered by prior credit; pool value after this expense

const CATEGORY_CONFIG: Record<string, { icon: string; cardBg: string; badgeBg: string; badgeText: string }> = {
  RENT:      { icon: "🏠", cardBg: "bg-violet-50 border-violet-100",  badgeBg: "bg-violet-100",  badgeText: "text-violet-700"  },
  GROCERIES: { icon: "🛒", cardBg: "bg-green-50 border-green-100",    badgeBg: "bg-green-100",   badgeText: "text-green-700"   },
  UTILITIES: { icon: "⚡", cardBg: "bg-orange-50 border-orange-100",  badgeBg: "bg-orange-100",  badgeText: "text-orange-700"  },
  WIFI:      { icon: "📶", cardBg: "bg-blue-50 border-blue-100",      badgeBg: "bg-blue-100",    badgeText: "text-blue-700"    },
  OTHER:     { icon: "📄", cardBg: "bg-gray-50 border-gray-200",      badgeBg: "bg-gray-100",    badgeText: "text-gray-600"    },
};

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(dateStr);
}

// Computes per-participant settlement status for every expense.
// After all events for a (payer, participant) pair are processed:
//   AUTO_CREDIT  — participant had pre-existing credit that covered the share
//                  remainingCredit = pool AFTER deducting share
//   SETTLED      — participant paid manually after the expense
//                  remainingCredit = pool remaining after all debts cleared (overpayment)
//   PENDING      — no settlement yet
function computeStatuses(
  expenses: Expense[],
  settlements: Settlement[]
): Map<string, Map<string, ParticipantStatus>> {
  const result = new Map<string, Map<string, ParticipantStatus>>();

  const pairSet = new Set<string>();
  for (const exp of expenses) {
    for (const p of exp.participants) {
      if (p.userId !== exp.paidBy) pairSet.add(`${exp.paidBy}|${p.userId}`);
    }
  }

  for (const pairKey of pairSet) {
    const [payerId, participantId] = pairKey.split("|");

    type ExpEvent = { type: "expense"; expId: string; share: number; time: number };
    type SetEvent = { type: "settlement"; amount: number; time: number };
    type Ev = ExpEvent | SetEvent;

    const events: Ev[] = [];
    const expEvents: ExpEvent[] = [];

    for (const exp of expenses) {
      if (exp.paidBy === payerId) {
        const p = exp.participants.find((pt) => pt.userId === participantId);
        if (p) {
          const ev: ExpEvent = { type: "expense", expId: exp.id, share: p.shareAmount, time: new Date(exp.expenseDate).getTime() };
          events.push(ev);
          expEvents.push(ev);
        }
      }
    }

    for (const s of settlements) {
      if (s.payerId === participantId && s.payeeId === payerId) {
        // Exclude the on-behalf-of portion — that money settled someone
        // else's credit (via a proposal), not this participant's own shares.
        const ownAmount = s.amount - s.onBehalfOfAmount;
        if (ownAmount > 0) {
          events.push({ type: "settlement", amount: ownAmount, time: new Date(s.settledAt).getTime() });
        }
      }
    }

    events.sort((a, b) => a.time - b.time);
    expEvents.sort((a, b) => a.time - b.time);

    let pool = 0;
    const pending: Array<{ expId: string; remaining: number }> = [];

    for (const ev of events) {
      if (ev.type === "expense") {
        if (!result.has(ev.expId)) result.set(ev.expId, new Map());
        const expMap = result.get(ev.expId)!;
        if (pool >= ev.share) {
          pool -= ev.share;
          expMap.set(participantId, { kind: "AUTO_CREDIT", remainingCredit: pool });
        } else {
          expMap.set(participantId, { kind: "PENDING" });
          pending.push({ expId: ev.expId, remaining: ev.share - pool });
          pool = 0;
        }
      } else {
        pool += ev.amount;
        while (pool > 0 && pending.length > 0) {
          const oldest = pending[0];
          if (pool >= oldest.remaining) {
            result.get(oldest.expId)?.set(participantId, { kind: "SETTLED" });
            pool -= oldest.remaining;
            pending.shift();
          } else {
            oldest.remaining -= pool;
            pool = 0;
          }
        }
      }
    }

    // If pool > 0 after all events, participant overpaid.
    // Store remainingCredit on the chronologically last expense so credit
    // shows exactly once on the most recent card.
    if (pool > 0 && expEvents.length > 0) {
      const lastExpId = expEvents[expEvents.length - 1].expId;
      const existing = result.get(lastExpId)?.get(participantId);
      // Only attach to SETTLED cards (AUTO_CREDIT already has remainingCredit set correctly)
      if (existing?.kind === "SETTLED") {
        result.get(lastExpId)?.set(participantId, { kind: "SETTLED", remainingCredit: pool });
      }
    }
  }

  return result;
}

export function ExpenseList({ roomId, expenses, settlements, members, currentUserId, currentUserRole }: ExpenseListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  const [showSettlements, setShowSettlements] = useState(false);
  const [availableCredit, setAvailableCredit] = useState(0);
  const [applyingCredit, setApplyingCredit] = useState<string | null>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const statusMap = useMemo(() => computeStatuses(expenses, settlements), [expenses, settlements]);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/credits`)
      .then((r) => r.json())
      .then((credits: Array<{ totalCredit: number; usedCredit: number }>) => {
        const total = credits.reduce((sum, c) => sum + (c.totalCredit - c.usedCredit), 0);
        setAvailableCredit(total);
      })
      .catch(() => {});
  }, [roomId]);

  async function handleApplyCredit(participantId: string) {
    setApplyingCredit(participantId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseParticipantId: participantId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setApplyingCredit(null);
    }
  }

  // Group expenses by date label, sorted newest first
  const expenseGroups = useMemo(() => {
    const groups = new Map<string, { label: string; exps: Expense[]; sortKey: number }>();
    for (const exp of expenses) {
      const label = getDateLabel(exp.expenseDate);
      const time = new Date(exp.expenseDate).getTime();
      if (!groups.has(label)) groups.set(label, { label, exps: [], sortKey: time });
      const g = groups.get(label)!;
      g.exps.push(exp);
      if (time > g.sortKey) g.sortKey = time;
    }
    return Array.from(groups.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .map((g) => ({ label: g.label, expenses: g.exps }));
  }, [expenses]);

  // Settlements sorted newest first
  const sortedSettlements = useMemo(
    () => [...settlements].sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()),
    [settlements]
  );

  async function handleDelete(expenseId: string) {
    setDeleting(expenseId);
    try {
      await fetch(`/api/rooms/${roomId}/expenses/${expenseId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  function toggleExpand(expId: string) {
    setExpandedExpenses((prev) => {
      const next = new Set(prev);
      if (next.has(expId)) next.delete(expId);
      else next.add(expId);
      return next;
    });
  }

  if (expenses.length === 0 && settlements.length === 0) {
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
    <div className="space-y-6">

      {/* ── CREDIT NOTIFICATION CARD ── */}
      {availableCredit > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">
              You have {formatCurrency(availableCredit)} credit available
            </p>
            <p className="text-xs text-blue-500 mt-0.5">
              Expand any expense card below and click <span className="font-semibold">Apply credit</span> on your pending shares.
            </p>
          </div>
        </div>
      )}

      {/* ── EXPENSE GROUPS BY DATE ── */}
      {expenseGroups.map(({ label, expenses: dayExps }) => (
        <div key={label}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">{label}</p>
          <div className="space-y-3">
            {dayExps.map((exp) => {
              const cat = CATEGORY_CONFIG[exp.category] ?? CATEGORY_CONFIG.OTHER;
              const paidByName = memberMap.get(exp.paidBy) ?? "Unknown";
              const iAmPayer = exp.paidBy === currentUserId;
              const myShare = exp.participants.find((p) => p.userId === currentUserId)?.shareAmount;
              const canDelete = exp.createdBy === currentUserId;
              const isExpanded = expandedExpenses.has(exp.id);
              const expStatuses = statusMap.get(exp.id);

              return (
                <div key={`exp-${exp.id}`} className={`rounded-xl border ${cat.cardBg} overflow-hidden`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl leading-none mt-0.5 shrink-0">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 truncate">{exp.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cat.badgeBg} ${cat.badgeText}`}>
                              {exp.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            Paid by{" "}
                            <span className="font-medium text-gray-700">{iAmPayer ? "You" : paidByName}</span>
                            <span className="mx-1">·</span>
                            {formatDate(exp.expenseDate)}
                          </p>
                          {myShare !== undefined && !iAmPayer && (
                            <div className="mt-2 inline-flex items-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg">
                              Your share: {formatCurrency(myShare)}
                            </div>
                          )}
                          {iAmPayer && (
                            <div className="mt-2 inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                              You paid
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-1 shrink-0">
                        <p className="font-bold text-gray-900 text-lg leading-none">{formatCurrency(exp.amount)}</p>
                        {canDelete && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-rose-500 -mt-0.5 ml-1"
                            onClick={() => handleDelete(exp.id)}
                            disabled={deleting === exp.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(exp.id)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? "Hide split details" : `View split details (${exp.participants.length} members)`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-black/5 bg-white/60 px-4 py-3 space-y-2.5">
                      {/* Participant rows */}
                      {exp.participants.map((p) => {
                        const name = memberMap.get(p.userId) ?? "Unknown";
                        const isMe = p.userId === currentUserId;
                        const isPayer = p.userId === exp.paidBy;
                        const computedStatus = expStatuses?.get(p.userId);
                        // If credit was explicitly applied (stored in DB), override status
                        // creditConfirmed=true → SETTLED (green), false → PENDING_SETTLEMENT (amber)
                        const status = p.creditApplied > 0
                          ? { kind: p.creditConfirmed ? "AUTO_CREDIT_SETTLED" as const : "AUTO_CREDIT_PENDING" as const, remainingCredit: 0 }
                          : computedStatus;

                        const canApplyCredit =
                          isMe &&
                          !isPayer &&
                          p.creditApplied === 0 &&
                          status?.kind === "PENDING" &&
                          availableCredit > 0;

                        return (
                          <div key={p.userId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                                {name[0]?.toUpperCase()}
                              </div>
                              <span className={`text-sm ${isMe ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                                {isMe ? "You" : name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-900">{formatCurrency(p.shareAmount)}</span>
                              {isPayer ? (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Paid</span>
                              ) : status?.kind === "SETTLED" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                                </span>
                              ) : status?.kind === "AUTO_CREDIT_SETTLED" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Credit settled
                                </span>
                              ) : status?.kind === "AUTO_CREDIT_PENDING" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                  <Clock className="h-3.5 w-3.5" /> Credit pending
                                </span>
                              ) : status?.kind === "AUTO_CREDIT" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                                  <Sparkles className="h-3.5 w-3.5" /> Auto-credit
                                </span>
                              ) : canApplyCredit ? (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                    <Clock className="h-3.5 w-3.5" /> Pending
                                  </span>
                                  <button
                                    onClick={() => handleApplyCredit(p.id)}
                                    disabled={applyingCredit === p.id}
                                    className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
                                  >
                                    {applyingCredit === p.id ? "Applying…" : "✦ Apply credit"}
                                  </button>
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                  <Clock className="h-3.5 w-3.5" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Credit summary — show for AUTO_CREDIT (remaining after use)
                          and for SETTLED with overpayment (remainingCredit set on last expense) */}
                      {(() => {
                        const creditHolders = exp.participants
                          .filter((p) => p.userId !== exp.paidBy)
                          .flatMap((p) => {
                            const s = expStatuses?.get(p.userId);
                            if (s?.kind === "AUTO_CREDIT" && s.remainingCredit > 0) {
                              return [{ userId: p.userId, credit: s.remainingCredit }];
                            }
                            if (s?.kind === "SETTLED" && s.remainingCredit && s.remainingCredit > 0) {
                              return [{ userId: p.userId, credit: s.remainingCredit }];
                            }
                            return [];
                          });

                        if (creditHolders.length === 0) return null;

                        return (
                          <div className="border-t border-blue-100 pt-2.5 mt-0.5">
                            <p className="text-xs text-blue-500 font-semibold mb-2">💰 Credit remaining</p>
                            {creditHolders.map((c) => (
                              <div key={c.userId} className="flex items-center justify-between">
                                <span className="text-xs font-medium text-blue-700">
                                  {c.userId === currentUserId ? "You" : (memberMap.get(c.userId) ?? "Unknown")}
                                </span>
                                <span className="text-xs font-semibold text-blue-700">
                                  {formatCurrency(c.credit)} credit with {iAmPayer ? "you" : paidByName}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── GLOBAL SETTLEMENTS SECTION (always at bottom, collapsed by default) ── */}
      {sortedSettlements.length > 0 && (
        <div>
          <button
            onClick={() => setShowSettlements((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <span className="text-sm font-bold text-emerald-700">💳 All Settlements</span>
            <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
              {sortedSettlements.length}
            </span>
            <span className="ml-auto text-emerald-600">
              {showSettlements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>

          {showSettlements && (
            <div className="mt-2 space-y-2">
              {sortedSettlements.map((s) => {
                const payerName = memberMap.get(s.payerId) ?? "Unknown";
                const payeeName = memberMap.get(s.payeeId) ?? "Unknown";
                const isMyPayment = s.payerId === currentUserId;
                const isMyReceipt = s.payeeId === currentUserId;

                return (
                  <div key={`set-${s.id}`} className="rounded-xl border border-emerald-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">💳</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                            <span className="truncate">{isMyPayment ? "You" : payerName}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{isMyReceipt ? "You" : payeeName}</span>
                          </div>
                          {s.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.note}</p>}
                          {s.onBehalfOfAmount > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              Includes {formatCurrency(s.onBehalfOfAmount)} for{" "}
                              {s.onBehalfOfUserId === currentUserId
                                ? "your"
                                : `${memberMap.get(s.onBehalfOfUserId ?? "") ?? "a member"}'s`}{" "}
                              credit
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-700">{formatCurrency(s.amount)}</p>
                        <p className="text-xs text-gray-400">{formatDate(s.settledAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edge: settlements exist but no expenses */}
      {expenses.length === 0 && settlements.length > 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No expenses yet. {settlements.length} settlement(s) recorded below.</p>
      )}
    </div>
  );
}
