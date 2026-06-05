"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, ChevronDown, ChevronUp, CheckCircle2, Clock, Sparkles, Receipt, ArrowRight } from "lucide-react";

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

type ParticipantStatus = { kind: "PENDING" } | { kind: "SETTLED" } | { kind: "AUTO_CREDIT" };

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

// Running-balance algorithm: determines per-participant status for each expense
// AUTO_CREDIT = covered by prior overpayment credit
// SETTLED     = manually settled after the expense
// PENDING     = not yet settled
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

    type Event =
      | { type: "expense"; expId: string; share: number; time: number }
      | { type: "settlement"; amount: number; time: number };

    const events: Event[] = [];

    for (const exp of expenses) {
      if (exp.paidBy === payerId) {
        const p = exp.participants.find((pt) => pt.userId === participantId);
        if (p) {
          events.push({ type: "expense", expId: exp.id, share: p.shareAmount, time: new Date(exp.expenseDate).getTime() });
        }
      }
    }

    for (const s of settlements) {
      if (s.payerId === participantId && s.payeeId === payerId) {
        events.push({ type: "settlement", amount: s.amount, time: new Date(s.settledAt).getTime() });
      }
    }

    events.sort((a, b) => a.time - b.time);

    let pool = 0;
    const pending: Array<{ expId: string; remaining: number }> = [];

    for (const event of events) {
      if (event.type === "expense") {
        if (!result.has(event.expId)) result.set(event.expId, new Map());
        const expMap = result.get(event.expId)!;
        if (pool >= event.share) {
          expMap.set(participantId, { kind: "AUTO_CREDIT" });
          pool -= event.share;
        } else {
          expMap.set(participantId, { kind: "PENDING" });
          pending.push({ expId: event.expId, remaining: event.share - pool });
          pool = 0;
        }
      } else {
        pool += event.amount;
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
  }

  return result;
}

type FeedItem =
  | { type: "expense"; data: Expense; date: string }
  | { type: "settlement"; data: Settlement; date: string };

export function ExpenseList({ roomId, expenses, settlements, members, currentUserId, currentUserRole }: ExpenseListProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const statusMap = useMemo(() => computeStatuses(expenses, settlements), [expenses, settlements]);

  const feed: FeedItem[] = useMemo(
    () =>
      [
        ...expenses.map((e) => ({ type: "expense" as const, data: e, date: e.expenseDate })),
        ...settlements.map((s) => ({ type: "settlement" as const, data: s, date: s.settledAt })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expenses, settlements]
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
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(expId)) next.delete(expId);
      else next.add(expId);
      return next;
    });
  }

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

  // Group by date label (feed is already sorted descending)
  const groups: { label: string; items: FeedItem[] }[] = [];
  for (const item of feed) {
    const label = getDateLabel(item.date);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="space-y-6">
      {groups.map(({ label, items }) => (
        <div key={label}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">{label}</p>
          <div className="space-y-3">
            {items.map((item) => {
              if (item.type === "settlement") {
                const s = item.data;
                const payerName = memberMap.get(s.payerId) ?? "Unknown";
                const payeeName = memberMap.get(s.payeeId) ?? "Unknown";
                const isMyPayment = s.payerId === currentUserId;
                const isMyReceipt = s.payeeId === currentUserId;
                return (
                  <div key={`set-${s.id}`} className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">💳</span>
                        <div className="min-w-0">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Settlement
                          </span>
                          <div className="flex items-center gap-1.5 mt-1 text-sm font-medium text-gray-800">
                            <span className="truncate">{isMyPayment ? "You" : payerName}</span>
                            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                            <span className="truncate">{isMyReceipt ? "You" : payeeName}</span>
                          </div>
                          {s.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.note}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-700">{formatCurrency(s.amount)}</p>
                        <p className="text-xs text-gray-400">{formatDate(s.settledAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              const exp = item.data;
              const cat = CATEGORY_CONFIG[exp.category] ?? CATEGORY_CONFIG.OTHER;
              const paidByName = memberMap.get(exp.paidBy) ?? "Unknown";
              const iAmPayer = exp.paidBy === currentUserId;
              const myParticipant = exp.participants.find((p) => p.userId === currentUserId);
              const myShare = myParticipant?.shareAmount;
              const canDelete = exp.createdBy === currentUserId || currentUserRole === "admin";
              const isExpanded = expanded.has(exp.id);
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
                            variant="ghost"
                            size="sm"
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
                      {exp.participants.map((p) => {
                        const name = memberMap.get(p.userId) ?? "Unknown";
                        const isMe = p.userId === currentUserId;
                        const isPayer = p.userId === exp.paidBy;
                        const status = expStatuses?.get(p.userId);

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
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  Paid
                                </span>
                              ) : status?.kind === "SETTLED" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                                </span>
                              ) : status?.kind === "AUTO_CREDIT" ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                                  <Sparkles className="h-3.5 w-3.5" /> Auto-credit
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                  <Clock className="h-3.5 w-3.5" /> Pending
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
