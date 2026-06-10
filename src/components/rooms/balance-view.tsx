"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/format";
import { AlertCircle, CheckCircle2, Clock, Users, TrendingUp, Sparkles } from "lucide-react";
import { RecordSettlementDialog } from "./record-settlement-dialog";

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

interface BalanceViewProps {
  roomId: string;
  balances: Balance[];
  pairwise: PairwiseBalance[];
  members: Member[];
  currentUserId: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function BalanceView({ roomId, balances, pairwise, members, currentUserId }: BalanceViewProps) {
  const memberOptions = members.map((m) => ({ id: m.id, name: m.name }));
  const memberEmailMap = new Map(members.map((m) => [m.id, m.email]));

  const [availableCredit, setAvailableCredit] = useState(0);
  useEffect(() => {
    fetch(`/api/rooms/${roomId}/credits`)
      .then((r) => r.json())
      .then((credits: Array<{ totalCredit: number; usedCredit: number }>) => {
        const total = credits.reduce((sum, c) => sum + (c.totalCredit - c.usedCredit), 0);
        setAvailableCredit(total);
      })
      .catch(() => {});
  }, [roomId]);

  const myBalance = balances.find((b) => b.userId === currentUserId);
  const myNet = myBalance?.netBalance ?? 0;

  // Payments YOU need to make
  const myDebts = pairwise.filter((p) => p.fromUserId === currentUserId);
  // Payments others need to make to YOU
  const myCredits = pairwise.filter((p) => p.toUserId === currentUserId);
  // Other members (not you)
  const otherBalances = balances.filter((b) => b.userId !== currentUserId);

  const profileBg = myNet > 0
    ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100"
    : myNet < 0
    ? "bg-gradient-to-br from-rose-50 to-red-50 border-rose-100"
    : "bg-gradient-to-br from-gray-50 to-slate-50 border-gray-100";

  const balanceColor = myNet > 0 ? "text-emerald-600" : myNet < 0 ? "text-rose-600" : "text-gray-400";
  const balanceLabel = myNet > 0 ? "You are owed" : myNet < 0 ? "You owe money" : "All settled up ✅";

  return (
    <div className="space-y-5">

      {/* ── CARD 1: YOUR PROFILE & BALANCE ── */}
      <div className={`rounded-2xl border p-5 ${profileBg}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className={`text-sm font-bold ${
                myNet > 0 ? "bg-emerald-200 text-emerald-800"
                : myNet < 0 ? "bg-rose-200 text-rose-800"
                : "bg-gray-200 text-gray-700"
              }`}>
                {initials(myBalance?.userName ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900 text-base">{myBalance?.userName ?? "You"}</p>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">You</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {myNet === 0
                  ? "No pending payments"
                  : myNet > 0
                  ? `${myCredits.length} member${myCredits.length !== 1 ? "s" : ""} owe${myCredits.length === 1 ? "s" : ""} you`
                  : `You owe ${myDebts.length} member${myDebts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500 mb-1">Your Balance</p>
            <p className={`text-3xl font-bold tracking-tight ${balanceColor}`}>
              {myNet === 0
                ? "₹0"
                : myNet > 0
                ? `+${formatCurrency(myNet)}`
                : `-${formatCurrency(Math.abs(myNet))}`}
            </p>
            <p className={`text-xs mt-0.5 font-medium ${balanceColor}`}>{balanceLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-black/5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{balances.length} members</span>
          </div>
          {myDebts.length > 0 && (
            <div className="flex items-center gap-1.5 text-rose-500 font-medium">
              <Clock className="h-3.5 w-3.5" />
              <span>{myDebts.length} payment{myDebts.length !== 1 ? "s" : ""} pending</span>
            </div>
          )}
          {myCredits.length > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{myCredits.length} awaiting payment</span>
            </div>
          )}
          {availableCredit > 0 && (
            <div className="flex items-center gap-1.5 text-blue-500 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{formatCurrency(availableCredit)} credit available</span>
            </div>
          )}
          {myNet === 0 && (
            <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
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
            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Payment Required
            </h3>
          </div>
          {myDebts.map((debt) => (
            <div key={`${debt.fromUserId}-${debt.toUserId}`}
              className="rounded-xl bg-white border border-rose-200 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-rose-100 text-rose-700 text-sm font-bold">
                        {initials(debt.toUserName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        Pay {debt.toUserName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {memberEmailMap.get(debt.toUserId) ?? ""}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-xs text-amber-600 font-medium">Pending</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-rose-600 leading-none">
                      {formatCurrency(debt.amount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">to be paid</p>
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
                  triggerLabel="Settle Now"
                  triggerClassName="w-full gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-semibold"
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
            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Owed To You
            </h3>
          </div>
          {myCredits.map((credit) => (
            <div key={`${credit.fromUserId}-${credit.toUserId}`}
              className="rounded-xl bg-white border border-emerald-200 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-bold">
                      {initials(credit.fromUserName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {credit.fromUserName}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {memberEmailMap.get(credit.fromUserId) ?? ""}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600 font-medium">Waiting to pay you</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-emerald-600 leading-none">
                    {formatCurrency(credit.amount)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">owed to you</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CARD 3: OTHER ROOM MEMBERS ── */}
      {otherBalances.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
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
                className="rounded-xl bg-white border border-gray-100 p-4 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                      {initials(b.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{b.userName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{statusNote}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-base ${
                    isNeutral ? "text-gray-400"
                    : isPositive ? "text-emerald-600"
                    : "text-rose-600"
                  }`}>
                    {isNeutral
                      ? "₹0"
                      : isPositive
                      ? `+${formatCurrency(b.netBalance)}`
                      : `-${formatCurrency(Math.abs(b.netBalance))}`}
                  </p>
                  {isNeutral && (
                    <p className="text-xs text-emerald-500 font-medium mt-0.5">✅ Settled</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All settled state */}
      {myNet === 0 && myDebts.length === 0 && myCredits.length === 0 && (
        <div className="text-center py-8">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-semibold text-gray-700">Everyone is settled up!</p>
          <p className="text-sm text-gray-400 mt-1">No pending payments in this room</p>
        </div>
      )}
    </div>
  );
}
