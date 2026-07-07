"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/format";
import { AlertCircle, CheckCircle2, Clock, Users, TrendingUp, Sparkles, Bell, X } from "lucide-react";
import { RecordSettlementDialog, type OptimisticSettlement } from "./record-settlement-dialog";
import { CoinStackIcon, CreditTokenIcon } from "@/components/icons/category-icons";

interface Balance {
  userId: string;
  userName: string;
  userAvatar: string | null;
  netBalance: number;
}

interface PairwiseBalance {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface SettlementProposal {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  triggeredByUserName: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface BalanceViewProps {
  roomId: string;
  balances: Balance[];
  pairwise: PairwiseBalance[];
  members: Member[];
  currentUserId: string;
  expenseCount: number;
  onOptimisticSettlement?: (settlement: OptimisticSettlement) => void;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function BalanceView({ roomId, balances, pairwise, members, currentUserId, expenseCount, onOptimisticSettlement }: BalanceViewProps) {
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));
  const memberEmailMap = new Map(members.map((m) => [m.id, m.email]));

  const [availableCredit, setAvailableCredit] = useState(0);
  const [proposals, setProposals] = useState<SettlementProposal[]>([]);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/credits`)
      .then((r) => r.json())
      .then((credits: Array<{ totalCredit: number; usedCredit: number }>) => {
        const total = credits.reduce((sum, c) => sum + (c.totalCredit - c.usedCredit), 0);
        setAvailableCredit(total);
      })
      .catch(() => {});

    fetch(`/api/rooms/${roomId}/proposals`)
      .then((r) => r.json())
      .then((data: SettlementProposal[]) => setProposals(data))
      .catch(() => {});
  }, [roomId]);

  function dismissProposal(proposalId: string) {
    fetch(`/api/rooms/${roomId}/proposals/${proposalId}`, { method: "PATCH" })
      .then(() => setProposals((prev) => prev.filter((p) => p.id !== proposalId)))
      .catch(() => {});
  }

  const myBalance = balances.find((b) => b.userId === currentUserId);
  const myNet = myBalance?.netBalance ?? 0;

  // Payments YOU need to make
  const myDebts = pairwise.filter((p) => p.fromUserId === currentUserId);
  // Payments others need to make to YOU
  const myCredits = pairwise.filter((p) => p.toUserId === currentUserId);
  // Other members (not you)
  const otherBalances = balances.filter((b) => b.userId !== currentUserId);

  const profileBg = myNet > 0
    ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/20"
    : myNet < 0
    ? "bg-gradient-to-br from-rose-50 to-red-50 border-rose-100 dark:from-rose-500/10 dark:to-rose-500/5 dark:border-rose-500/20"
    : "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-100 dark:from-muted/60 dark:to-muted/30 dark:border-border";

  const balanceColor = myNet > 0 ? "text-emerald-600 dark:text-emerald-400" : myNet < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
  const balanceLabel = myNet > 0 ? "You are owed" : myNet < 0 ? "You owe money" : "All settled up";

  // Proposals where YOU must pay
  const myProposals = proposals.filter((p) => p.fromUserId === currentUserId);
  // Proposals where others will pay YOU (informational)
  const incomingProposals = proposals.filter((p) => p.toUserId === currentUserId);

  return (
    <div className="space-y-5">

      {/* ── SUGGESTED SETTLEMENTS (action required for me) ── */}
      {myProposals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Bell className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Action Required
            </h3>
          </div>
          {myProposals.map((proposal) => (
            <div key={proposal.id}
              className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">
                        Pay {proposal.toUserName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {proposal.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <p className="font-money text-xl font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(proposal.amount)}
                    </p>
                    <button
                      onClick={() => dismissProposal(proposal.id)}
                      className="text-muted-foreground hover:text-foreground mt-0.5"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4">
                <RecordSettlementDialog
                  roomId={roomId}
                  members={memberOptions}
                  currentUserId={currentUserId}
                  prefillPayeeId={proposal.toUserId}
                  prefillAmount={proposal.amount}
                  lockParties
                  onOptimisticRecord={onOptimisticSettlement}
                  triggerLabel={`Pay ${proposal.toUserName} ${formatCurrency(proposal.amount)}`}
                  triggerClassName="w-full gap-2 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/15 font-semibold"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── INCOMING SETTLEMENTS (informational — others will pay me) ── */}
      {incomingProposals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
              Incoming Payments
            </h3>
          </div>
          {incomingProposals.map((proposal) => (
            <div key={proposal.id}
              className="rounded-xl bg-indigo-50 border border-indigo-100 dark:bg-primary/10 dark:border-primary/20 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {proposal.fromUserName} will pay you
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{proposal.reason}</p>
                </div>
                <p className="font-money text-xl font-bold text-primary shrink-0">
                  {formatCurrency(proposal.amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CARD 1: YOUR PROFILE & BALANCE ── */}
      <div className={`rounded-2xl border p-5 ${profileBg}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className={`text-sm font-bold ${
                myNet > 0 ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200"
                : myNet < 0 ? "bg-rose-200 text-rose-800 dark:bg-rose-500/25 dark:text-rose-200"
                : "bg-muted text-muted-foreground"
              }`}>
                {initials(myBalance?.userName ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-foreground text-base truncate">{myBalance?.userName ?? "You"}</p>
                <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-primary/20 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">You</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {myNet === 0
                  ? "No pending payments"
                  : myNet > 0
                  ? `${myCredits.length} member${myCredits.length !== 1 ? "s" : ""} owe${myCredits.length === 1 ? "s" : ""} you`
                  : `You owe ${myDebts.length} member${myDebts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
            <p className={`font-money text-2xl sm:text-3xl font-bold tracking-tight ${balanceColor}`}>
              {myNet === 0
                ? "₹0"
                : myNet > 0
                ? `+${formatCurrency(myNet)}`
                : `-${formatCurrency(Math.abs(myNet))}`}
            </p>
            <p className={`text-xs mt-0.5 font-medium ${balanceColor}`}>{balanceLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-black/5 dark:border-white/10 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{balances.length} members</span>
          </div>
          {myDebts.length > 0 && (
            <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-medium">
              <Clock className="h-3.5 w-3.5" />
              <span>{myDebts.length} payment{myDebts.length !== 1 ? "s" : ""} pending</span>
            </div>
          )}
          {myCredits.length > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{myCredits.length} awaiting payment</span>
            </div>
          )}
          {availableCredit > 0 && myNet !== 0 && (
            <div className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400 font-medium">
              <CreditTokenIcon size={13} />
              <span>{formatCurrency(availableCredit)} credit available</span>
            </div>
          )}
          {myNet === 0 && (
            <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Fully settled</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 2: PAYMENTS YOU NEED TO MAKE ── */}
      {myDebts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Payment Required
            </h3>
          </div>
          {myDebts.map((debt) => (
            <div key={`${debt.fromUserId}-${debt.toUserId}`}
              className="rounded-xl bg-card border border-rose-200 dark:border-rose-500/25 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-sm font-bold">
                        {initials(debt.toUserName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">
                        Pay {debt.toUserName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {memberEmailMap.get(debt.toUserId) ?? ""}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pending</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-money text-2xl font-bold text-rose-600 dark:text-rose-400 leading-none">
                      {formatCurrency(debt.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">to be paid</p>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4">
                <RecordSettlementDialog
                  roomId={roomId}
                  members={memberOptions}
                  currentUserId={currentUserId}
                  prefillPayeeId={debt.toUserId}
                  prefillAmount={debt.amount}
                  lockParties
                  onOptimisticRecord={onOptimisticSettlement}
                  triggerLabel="Settle Now"
                  triggerClassName="w-full gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10 font-semibold"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CARD 2B: PAYMENTS OWED TO YOU ── */}
      {myCredits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
            <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Owed To You
            </h3>
          </div>
          {myCredits.map((credit) => (
            <div key={`${credit.fromUserId}-${credit.toUserId}`}
              className="rounded-xl bg-card border border-emerald-200 dark:border-emerald-500/25 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-sm font-bold">
                      {initials(credit.fromUserName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {credit.fromUserName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {memberEmailMap.get(credit.fromUserId) ?? ""}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Waiting to pay you</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-money text-2xl font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                    {formatCurrency(credit.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">owed to you</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CARD 3: OTHER ROOM MEMBERS ── */}
      {otherBalances.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Room Members
          </h3>
          {otherBalances.map((b) => {
            const isPositive = b.netBalance > 0;
            const isNeutral = b.netBalance === 0;
            const theyOweMe = pairwise.find(
              (p) => p.fromUserId === b.userId && p.toUserId === currentUserId
            );
            const iOweThem = pairwise.find(
              (p) => p.fromUserId === currentUserId && p.toUserId === b.userId
            );

            let statusNote = "";
            if (isNeutral) statusNote = "Settled";
            else if (theyOweMe) statusNote = `Owes you ${formatCurrency(theyOweMe.amount)}`;
            else if (iOweThem) statusNote = `You owe ${formatCurrency(iOweThem.amount)}`;
            else if (isPositive) statusNote = "Owed by others";
            else statusNote = "Owes others";

            return (
              <div key={b.userId}
                className="rounded-xl bg-card border border-border p-4 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-primary/20 dark:text-indigo-300 text-xs font-bold">
                      {initials(b.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{b.userName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{statusNote}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-money font-bold text-base ${
                    isNeutral ? "text-muted-foreground"
                    : isPositive ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {isNeutral
                      ? "₹0"
                      : isPositive
                      ? `+${formatCurrency(b.netBalance)}`
                      : `-${formatCurrency(Math.abs(b.netBalance))}`}
                  </p>
                  {isNeutral && (
                    <p className="flex items-center justify-end gap-1 text-xs text-emerald-500 dark:text-emerald-400 font-medium mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Settled
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty / settled state */}
      {myNet === 0 && myDebts.length === 0 && myCredits.length === 0 && (
        expenseCount === 0 ? (
          <div className="flex flex-col items-center text-center py-10">
            <CoinStackIcon size={56} className="mb-3" />
            <p className="font-semibold text-foreground/90">No balances yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first expense in the Activity tab to see balances here.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />
              <span className="text-sm font-semibold text-gold-foreground dark:text-gold">All settled up</span>
            </span>
            <p className="font-semibold text-foreground/90">Everyone is settled up!</p>
            <p className="text-sm text-muted-foreground mt-1">No pending payments in this room.</p>
          </div>
        )
      )}
    </div>
  );
}
