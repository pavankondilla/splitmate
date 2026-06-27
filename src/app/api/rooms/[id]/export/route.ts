import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getRoomDetail } from "@/services/room.service";
import { getRoomExpenses } from "@/services/expense.service";
import { getRoomSettlements } from "@/services/settlement.service";
import { getRoomBalances } from "@/services/balance.service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

function esc(value: string | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function paise(amount: number): string {
  return (amount / 100).toFixed(2);
}

function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;

    let detail, expenses, settlements, balances;
    try {
      [detail, expenses, settlements, balances] = await Promise.all([
        getRoomDetail(id, user.id),
        getRoomExpenses(id, user.id),
        getRoomSettlements(id, user.id),
        getRoomBalances(id, user.id),
      ]);
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ForbiddenError) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      throw err;
    }

    const { room, members } = detail;
    const userMap = new Map(members.map((m) => [m.user.id, m.user.name]));
    const now = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    const rows: string[] = [];

    // ── Header ─────────────────────────────────────────────────────────────
    rows.push(`SPLITMATE EXPORT`);
    rows.push(`Room,${esc(room.name)}`);
    rows.push(`Generated,${now}`);
    rows.push(`Members,${members.length}`);
    rows.push(`Currency,${room.currency}`);
    rows.push(``);

    // ── Expenses ───────────────────────────────────────────────────────────
    rows.push(`EXPENSES`);
    rows.push([
      "Date",
      "Title",
      "Category",
      "Total (INR)",
      "Paid By",
      "Participant",
      "Share (INR)",
      "Credit Applied (INR)",
    ].join(","));

    for (const exp of expenses) {
      const paidByName = esc(userMap.get(exp.paidBy) ?? "Unknown");
      const date = fmtDate(exp.expenseDate);
      for (const p of exp.participants) {
        const participantName = esc(userMap.get(p.userId) ?? "Unknown");
        const isPayer = p.userId === exp.paidBy;
        rows.push([
          esc(date),
          esc(exp.title),
          esc(exp.category),
          isPayer ? "" : paise(exp.amount),
          paidByName,
          participantName,
          isPayer ? "" : paise(p.shareAmount),
          p.creditApplied > 0 ? paise(p.creditApplied) : "",
        ].join(","));
      }
    }

    rows.push(``);

    // ── Settlements ────────────────────────────────────────────────────────
    rows.push(`SETTLEMENTS`);
    rows.push(["Date", "Paid By", "Received By", "Amount (INR)", "Note"].join(","));

    for (const s of settlements) {
      rows.push([
        esc(fmtDate(s.settledAt)),
        esc(userMap.get(s.payerId) ?? "Unknown"),
        esc(userMap.get(s.payeeId) ?? "Unknown"),
        paise(s.amount),
        esc(s.note),
      ].join(","));
    }

    rows.push(``);

    // ── Net Balances ───────────────────────────────────────────────────────
    rows.push(`NET BALANCES`);
    rows.push(["Member", "Net Balance (INR)", "Status"].join(","));

    for (const b of balances) {
      const status =
        b.netBalance > 0 ? "Is owed" : b.netBalance < 0 ? "Owes" : "Settled up";
      rows.push([
        esc(b.userName),
        paise(b.netBalance),
        esc(status),
      ].join(","));
    }

    const csv = rows.join("\r\n");
    const filename = `splitmate-${room.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
