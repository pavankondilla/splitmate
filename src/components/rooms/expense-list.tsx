"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, Pencil, ChevronDown, ChevronUp, CheckCircle2, Clock, Receipt, ArrowRight } from "lucide-react";
import { EditExpenseDialog } from "@/components/rooms/edit-expense-dialog";
import { AddExpenseDialog } from "@/components/rooms/add-expense-dialog";
import { CategoryIcon, CoinIcon, CreditTokenIcon } from "@/components/icons/category-icons";

interface Participant { id: string; userId: string; shareAmount: number; creditApplied: number; creditConfirmed: boolean }
interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  expenseDate: string;
  notes: string | null;
  // When the expense was actually entered. Event ordering must use this, not
  // expenseDate: the date has no clock time (sorts at midnight) and can be
  // backdated, which would wrongly place expenses before settlements that
  // were recorded earlier in real time.
  createdAt: string | Date;
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
interface Credit {
  id: string;
  userId: string;        // credit holder
  owedByUserId: string;  // who owes it back
  totalCredit: number;
  usedCredit: number;
  isExhausted: boolean;
  status: string;
}

interface ExpenseListProps {
  roomId: string;
  expenses: Expense[];
  settlements: Settlement[];
  credits: Credit[];
  members: Member[];
  currentUserId: string;
  currentUserRole: string;
  onExpenseRemoved?: (id: string) => void;
  onExpenseAdded?: (expense: Expense) => void;
}

type ParticipantStatus =
  | { kind: "PENDING" }
  | { kind: "SETTLED" };

// Emoji-free (Phase 44): card art comes from the drawn icon kit via
// <CategoryIcon>. Tints carry light + dark variants.
const CATEGORY_CONFIG: Record<string, { cardBg: string; badgeBg: string; badgeText: string }> = {
  RENT:      { cardBg: "bg-violet-50 border-violet-100 dark:bg-indigo-500/10 dark:border-indigo-500/20",   badgeBg: "bg-violet-100 dark:bg-indigo-500/15",  badgeText: "text-violet-700 dark:text-indigo-300"  },
  GROCERIES: { cardBg: "bg-green-50 border-green-100 dark:bg-emerald-500/10 dark:border-emerald-500/20",   badgeBg: "bg-green-100 dark:bg-emerald-500/15",  badgeText: "text-green-700 dark:text-emerald-300"  },
  UTILITIES: { cardBg: "bg-orange-50 border-orange-100 dark:bg-amber-500/10 dark:border-amber-500/20",     badgeBg: "bg-orange-100 dark:bg-amber-500/15",   badgeText: "text-orange-700 dark:text-amber-300"   },
  WIFI:      { cardBg: "bg-blue-50 border-blue-100 dark:bg-sky-500/10 dark:border-sky-500/20",             badgeBg: "bg-blue-100 dark:bg-sky-500/15",       badgeText: "text-blue-700 dark:text-sky-300"       },
  OTHER:     { cardBg: "bg-gray-50 border-gray-200 dark:bg-muted/40 dark:border-border",                   badgeBg: "bg-gray-100 dark:bg-muted",            badgeText: "text-gray-600 dark:text-muted-foreground" },
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

// Computes per-participant settlement status for every expense by allocating
// real settlements to pending shares (oldest first) per (payer, participant)
// pair. Overpayment surplus stays in the pool but NEVER covers later shares —
// surplus is a credit (user_credits in the DB) and only an explicit
// "Apply credit" marks a share covered (via creditApplied, handled at render).
// Credit remaining is likewise displayed from the DB, not derived here.
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

    type Ev =
      | { type: "expense"; expId: string; share: number; time: number }
      | { type: "settlement"; amount: number; time: number };

    const events: Ev[] = [];

    for (const exp of expenses) {
      if (exp.paidBy === payerId) {
        const p = exp.participants.find((pt) => pt.userId === participantId);
        if (p) {
          // Credit-covered portion is not owed in cash — only the remainder
          // needs a settlement allocated to it.
          const cashShare = Math.max(0, p.shareAmount - p.creditApplied);
          events.push({ type: "expense", expId: exp.id, share: cashShare, time: new Date(exp.createdAt).getTime() });
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

    let pool = 0;
    const pending: Array<{ expId: string; remaining: number }> = [];

    for (const ev of events) {
      if (ev.type === "expense") {
        if (!result.has(ev.expId)) result.set(ev.expId, new Map());
        result.get(ev.expId)!.set(participantId, { kind: "PENDING" });
        if (ev.share > 0) pending.push({ expId: ev.expId, remaining: ev.share });
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
        // Any surplus after covering all pending shares became a user_credit
        // (detectAndCreateCredit). Drop it from the cash pool — the same money
        // must not also cover future shares; applying credit is explicit.
        pool = 0;
      }
    }
  }

  return result;
}

const PAGE_SIZE = 20;

export function ExpenseList({ roomId, expenses, settlements, credits, members, currentUserId, currentUserRole, onExpenseRemoved, onExpenseAdded }: ExpenseListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  const [showSettlements, setShowSettlements] = useState(false);
  const [applyingCredit, setApplyingCredit] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const statusMap = useMemo(() => computeStatuses(expenses, settlements), [expenses, settlements]);

  // Current user's available credit — straight from the DB (server-provided),
  // refreshed via router.refresh() after every mutation.
  const availableCredit = useMemo(
    () =>
      credits
        .filter((c) => c.userId === currentUserId && !c.isExhausted)
        .reduce((sum, c) => sum + (c.totalCredit - c.usedCredit), 0),
    [credits, currentUserId]
  );

  // Only show the credit banner when the user actually has pending expense shares
  // to apply credit to. A stale/spurious credit with no applicable shares would
  // produce a misleading banner even though nothing can be applied.
  const hasApplicableShare = useMemo(() => {
    for (const exp of expenses) {
      for (const p of exp.participants) {
        if (p.userId !== currentUserId || p.userId === exp.paidBy) continue;
        if (p.creditApplied > 0) continue;
        const status = statusMap.get(exp.id)?.get(p.userId);
        if (status?.kind === "PENDING") return true;
      }
    }
    return false;
  }, [expenses, statusMap, currentUserId]);

  // Remaining credit per (holder, owedBy) pair — also straight from the DB.
  const creditRemainingByPair = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of credits) {
      if (c.isExhausted) continue;
      const remaining = c.totalCredit - c.usedCredit;
      if (remaining <= 0) continue;
      const key = `${c.owedByUserId}|${c.userId}`;
      map.set(key, (map.get(key) ?? 0) + remaining);
    }
    return map;
  }, [credits]);

  // The most recent expense per (payer, participant) pair — credit remaining
  // is displayed once, on that card, instead of repeating on every card.
  const latestExpenseForPair = useMemo(() => {
    const map = new Map<string, { expId: string; time: number }>();
    for (const exp of expenses) {
      const time = new Date(exp.createdAt).getTime();
      for (const p of exp.participants) {
        if (p.userId === exp.paidBy) continue;
        const key = `${exp.paidBy}|${p.userId}`;
        const current = map.get(key);
        if (!current || time >= current.time) map.set(key, { expId: exp.id, time });
      }
    }
    return map;
  }, [expenses]);

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

  // Group ALL expenses by date label, sorted newest first.
  // computeStatuses still uses the full expenses array — grouping is display-only.
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

  // Slice groups to visibleCount total expenses (newest first).
  const { visibleGroups, hasMore } = useMemo(() => {
    let remaining = visibleCount;
    const result: Array<{ label: string; expenses: Expense[] }> = [];
    for (const group of expenseGroups) {
      if (remaining <= 0) break;
      result.push({ label: group.label, expenses: group.expenses.slice(0, remaining) });
      remaining -= group.expenses.length;
    }
    return { visibleGroups: result, hasMore: visibleCount < expenses.length };
  }, [expenseGroups, visibleCount, expenses.length]);

  // Settlements sorted newest first
  const sortedSettlements = useMemo(
    () => [...settlements].sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()),
    [settlements]
  );

  async function handleDelete(expenseId: string) {
    setDeleting(expenseId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/expenses/${expenseId}`, { method: "DELETE" });
      if (res.ok) {
        // Optimistically drop the card inside the refresh transition — it
        // disappears instantly and stays gone once server data arrives.
        startTransition(() => {
          onExpenseRemoved?.(expenseId);
          router.refresh();
        });
      } else {
        router.refresh();
      }
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
        <div className="h-14 w-14 bg-muted rounded-full flex items-center justify-center mb-4">
          <Receipt className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">No expenses yet</h3>
        <p className="text-muted-foreground text-sm mb-5 max-w-xs">
          Add your first shared expense — rent, groceries, utilities — and SplitMate will split it for you.
        </p>
        <AddExpenseDialog roomId={roomId} members={members} currentUserId={currentUserId} onOptimisticAdd={onExpenseAdded} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── CREDIT NOTIFICATION CARD ── */}
      {availableCredit > 0 && hasApplicableShare && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 px-4 py-3 flex items-start gap-3">
          <CreditTokenIcon size={30} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              You have {formatCurrency(availableCredit)} credit available
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-300/80 mt-0.5">
              Expand any expense card below and click <span className="font-semibold">Apply credit</span> on your pending shares.
            </p>
          </div>
        </div>
      )}

      {/* ── EXPENSE GROUPS BY DATE ── */}
      {visibleGroups.map(({ label, expenses: dayExps }) => (
        <div key={label}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{label}</p>
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
                        <CategoryIcon category={exp.category} size={28} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground truncate">{exp.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cat.badgeBg} ${cat.badgeText}`}>
                              {exp.category}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Paid by{" "}
                            <span className="font-medium text-foreground/80">{iAmPayer ? "You" : paidByName}</span>
                            <span className="mx-1">·</span>
                            {formatDate(exp.expenseDate)}
                          </p>
                          {myShare !== undefined && !iAmPayer && (
                            <div className="mt-2 inline-flex items-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20 px-2.5 py-1 rounded-lg">
                              Your share: {formatCurrency(myShare)}
                            </div>
                          )}
                          {iAmPayer && (
                            <div className="mt-2 inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg">
                              You paid
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-1 shrink-0">
                        <p className="font-money font-bold text-foreground text-lg leading-none">{formatCurrency(exp.amount)}</p>
                        {canDelete && (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary -mt-0.5 ml-1"
                              onClick={() => setEditingExpense(exp)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 -mt-0.5"
                              onClick={() => handleDelete(exp.id)}
                              disabled={deleting === exp.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(exp.id)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? "Hide split details" : `View split details (${exp.participants.length} members)`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/60 bg-card/60 px-4 py-3 space-y-2.5">
                      {/* Participant rows */}
                      {exp.participants.map((p) => {
                        const name = memberMap.get(p.userId) ?? "Unknown";
                        const isMe = p.userId === currentUserId;
                        const isPayer = p.userId === exp.paidBy;
                        const computedStatus = expStatuses?.get(p.userId);
                        // If credit was explicitly applied (stored in DB), override status
                        // creditConfirmed=true → SETTLED (green), false → PENDING_SETTLEMENT (amber)
                        const status = p.creditApplied > 0
                          ? { kind: p.creditConfirmed ? "AUTO_CREDIT_SETTLED" as const : "AUTO_CREDIT_PENDING" as const }
                          : computedStatus;

                        const canApplyCredit =
                          isMe &&
                          !isPayer &&
                          p.creditApplied === 0 &&
                          status?.kind === "PENDING" &&
                          availableCredit > 0;

                        return (
                          <div key={p.userId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                                {name[0]?.toUpperCase()}
                              </div>
                              <span className={`text-sm truncate ${isMe ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                                {isMe ? "You" : name}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 ml-auto">
                              <span className="text-sm font-medium text-foreground">{formatCurrency(p.shareAmount)}</span>
                              {isPayer ? (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">Paid</span>
                              ) : status?.kind === "SETTLED" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                                </span>
                              ) : status?.kind === "AUTO_CREDIT_SETTLED" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Credit settled
                                </span>
                              ) : status?.kind === "AUTO_CREDIT_PENDING" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <Clock className="h-3.5 w-3.5" /> Credit pending
                                </span>
                              ) : canApplyCredit ? (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    <Clock className="h-3.5 w-3.5" /> Pending
                                  </span>
                                  <button
                                    onClick={() => handleApplyCredit(p.id)}
                                    disabled={applyingCredit === p.id}
                                    className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30 dark:hover:bg-blue-500/20 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50"
                                  >
                                    {applyingCredit === p.id ? "Applying…" : "✦ Apply credit"}
                                  </button>
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <Clock className="h-3.5 w-3.5" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Credit summary — real remaining credit from user_credits,
                          shown once per pair on the most recent expense card */}
                      {(() => {
                        const creditHolders = exp.participants
                          .filter((p) => p.userId !== exp.paidBy)
                          .flatMap((p) => {
                            const pairKey = `${exp.paidBy}|${p.userId}`;
                            if (latestExpenseForPair.get(pairKey)?.expId !== exp.id) return [];
                            const remaining = creditRemainingByPair.get(pairKey) ?? 0;
                            if (remaining <= 0) return [];
                            return [{ userId: p.userId, credit: remaining }];
                          });

                        if (creditHolders.length === 0) return null;

                        return (
                          <div className="border-t border-blue-100 dark:border-blue-500/20 pt-2.5 mt-0.5">
                            <p className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-300 font-semibold mb-2">
                              <CreditTokenIcon size={14} /> Credit remaining
                            </p>
                            {creditHolders.map((c) => (
                              <div key={c.userId} className="flex items-center justify-between">
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                  {c.userId === currentUserId ? "You" : (memberMap.get(c.userId) ?? "Unknown")}
                                </span>
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
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

      {/* ── LOAD MORE ── */}
      {hasMore && (
        <div className="flex items-center justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="gap-2 text-muted-foreground"
          >
            <ChevronDown className="h-4 w-4" />
            Load {Math.min(PAGE_SIZE, expenses.length - visibleCount)} older expenses
          </Button>
        </div>
      )}

      {/* ── GLOBAL SETTLEMENTS SECTION (always at bottom, collapsed by default) ── */}
      {sortedSettlements.length > 0 && (
        <div>
          <button
            onClick={() => setShowSettlements((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
              <CoinIcon size={18} /> All Settlements
            </span>
            <span className="text-xs bg-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 px-2 py-0.5 rounded-full font-semibold">
              {sortedSettlements.length}
            </span>
            <span className="ml-auto text-emerald-600 dark:text-emerald-400">
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
                  <div key={`set-${s.id}`} className="rounded-xl border border-emerald-100 dark:border-emerald-500/20 bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <CoinIcon size={22} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                            <span className="truncate">{isMyPayment ? "You" : payerName}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{isMyReceipt ? "You" : payeeName}</span>
                          </div>
                          {s.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.note}</p>}
                          {s.onBehalfOfAmount > 0 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
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
                        <p className="font-money font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(s.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(s.settledAt)}</p>
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
        <p className="text-sm text-muted-foreground text-center py-4">No expenses yet. {settlements.length} settlement(s) recorded below.</p>
      )}

      {editingExpense && (
        <EditExpenseDialog
          roomId={roomId}
          members={members}
          expense={{
            ...editingExpense,
            participantIds: editingExpense.participants.map((p) => p.userId),
          }}
          open={editingExpense !== null}
          onOpenChange={(open) => { if (!open) setEditingExpense(null); }}
        />
      )}
    </div>
  );
}
