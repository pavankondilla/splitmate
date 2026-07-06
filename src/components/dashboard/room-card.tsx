import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface RoomCardProps {
  id: string;
  name: string;
  memberCount: number;
  expenseCount: number;
  myNetBalance: number;
}

export function RoomCard({ id, name, memberCount, expenseCount, myNetBalance }: RoomCardProps) {
  const isPositive = myNetBalance > 0;
  const isNeutral = myNetBalance === 0;

  return (
    <Link href={`/rooms/${id}`}>
      <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">{name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {memberCount} members
            </span>
            <span className="flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5" /> {expenseCount} expenses
            </span>
          </div>
          <div>
            {isNeutral ? (
              <Badge variant="secondary">Settled up</Badge>
            ) : (
              <div className={`text-sm font-semibold font-money ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {isPositive ? "You are owed " : "You owe "}
                {formatCurrency(Math.abs(myNetBalance))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
