import { formatCurrency } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight } from "lucide-react";

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

interface BalanceViewProps {
  balances: Balance[];
  pairwise: PairwiseBalance[];
  currentUserId: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function BalanceView({ balances, pairwise, currentUserId }: BalanceViewProps) {
  return (
    <div className="space-y-8">
      {/* Per-member balances */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Net balances</h3>
        <div className="space-y-3">
          {balances.map((b) => {
            const isPositive = b.netBalance > 0;
            const isNeutral = b.netBalance === 0;
            const isYou = b.userId === currentUserId;

            // Who owes this person
            const owedBy = pairwise.filter((p) => p.toUserId === b.userId);
            // Who this person owes
            const owesTo = pairwise.filter((p) => p.fromUserId === b.userId);

            const subNote = isNeutral ? null
              : isPositive
              ? owedBy.map((p) => `${p.fromUserId === currentUserId ? "You" : p.fromUserName} owes ${formatCurrency(p.amount)}`).join(" · ")
              : owesTo.map((p) => `Pay ${p.toUserId === currentUserId ? "you" : p.toUserName} ${formatCurrency(p.amount)}`).join(" · ");

            return (
              <div key={b.userId} className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                      {initials(b.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-gray-900">
                      {b.userName}{isYou && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                    </span>
                    {subNote && <p className="text-xs text-gray-400 mt-0.5">{subNote}</p>}
                  </div>
                </div>
                <div className={`font-semibold text-sm shrink-0 ${isNeutral ? "text-gray-400" : isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                  {isNeutral ? "Settled" : isPositive ? `+${formatCurrency(b.netBalance)}` : `-${formatCurrency(Math.abs(b.netBalance))}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pairwise */}
      {pairwise.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Who owes whom</h3>
          <div className="space-y-2">
            {pairwise.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4 bg-rose-50 rounded-lg border border-rose-100">
                <span className="font-medium text-gray-900 text-sm">
                  {p.fromUserId === currentUserId ? "You" : p.fromUserName}
                </span>
                <ArrowRight className="h-4 w-4 text-rose-400 shrink-0" />
                <span className="font-medium text-gray-900 text-sm flex-1">
                  {p.toUserId === currentUserId ? "You" : p.toUserName}
                </span>
                <span className="font-semibold text-rose-600 text-sm">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pairwise.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">Everyone is settled up! 🎉</div>
      )}
    </div>
  );
}
