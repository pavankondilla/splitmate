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
      {/* Per-member balances with person-centric debts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Your settlement status</h3>
        <div className="space-y-3">
          {balances.map((b) => {
            const isPositive = b.netBalance > 0;
            const isNeutral = b.netBalance === 0;
            const isYou = b.userId === currentUserId;

            // Person-centric: who owes THIS person, and who THIS person owes
            const owedByList = pairwise.filter((p) => p.toUserId === b.userId);
            const owesToList = pairwise.filter((p) => p.fromUserId === b.userId);

            let subNote = null;
            if (!isNeutral) {
              if (isPositive) {
                // This person is owed money
                const debtors = owedByList.map((p) => ({
                  name: p.fromUserId === currentUserId ? "You" : p.fromUserName,
                  amount: p.amount,
                }));
                subNote = debtors.map((d) => `${d.name} owes ${formatCurrency(d.amount)}`).join(" · ");
              } else {
                // This person owes money
                const creditors = owesToList.map((p) => ({
                  name: p.toUserId === currentUserId ? "you" : p.toUserName,
                  amount: p.amount,
                }));
                subNote = creditors.map((c) => `You owe ${c.name} ${formatCurrency(c.amount)}`).join(" · ");
              }
            }

            return (
              <div key={b.userId} className="flex items-center justify-between py-3 px-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                      {initials(b.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">
                      {b.userName}{isYou && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                    </span>
                    {subNote && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{subNote}</p>}
                  </div>
                </div>
                <div className={`font-semibold text-sm shrink-0 text-right ${isNeutral ? "text-gray-400" : isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                  {isNeutral ? "Settled" : isPositive ? `+${formatCurrency(b.netBalance)}` : `-${formatCurrency(Math.abs(b.netBalance))}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pairwise.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">Everyone is settled up! 🎉</div>
      )}
    </div>
  );
}
