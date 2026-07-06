"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calculateEqualShares } from "@/lib/split";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface Member { id: string; name: string }

// Shape matching the room page's serialized expense — shown instantly in the
// Activity list until router.refresh() lands the authoritative server data.
export interface OptimisticExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  expenseDate: string;
  notes: string | null;
  createdAt: string;
  createdBy: string;
  participants: Array<{ id: string; userId: string; shareAmount: number; creditApplied: number; creditConfirmed: boolean }>;
}

interface AddExpenseDialogProps {
  roomId: string;
  members: Member[];
  currentUserId: string;
  onOptimisticAdd?: (expense: OptimisticExpense) => void;
}

const CATEGORIES = ["RENT", "GROCERIES", "UTILITIES", "WIFI", "OTHER"] as const;

export function AddExpenseDialog({ roomId, members, currentUserId, onOptimisticAdd }: AddExpenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "OTHER",
    paidBy: currentUserId,
    expenseDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [participantIds, setParticipantIds] = useState<string[]>(members.map((m) => m.id));
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  function toggleParticipant(id: string) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (participantIds.length === 0) { setError("Select at least one participant"); return; }
    const amountPaise = Math.round(parseFloat(form.amount) * 100);
    if (isNaN(amountPaise) || amountPaise <= 0) { setError("Enter a valid amount"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          amount: amountPaise,
          category: form.category,
          splitType: "EQUAL",
          paidBy: form.paidBy,
          expenseDate: form.expenseDate,
          notes: form.notes || undefined,
          participantIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add expense");
      }
      const created = await res.json().catch(() => null);
      const optimistic: OptimisticExpense = {
        id: created?.id ?? `optimistic-${Date.now()}`,
        title: form.title,
        amount: amountPaise,
        category: form.category,
        paidBy: form.paidBy,
        expenseDate: form.expenseDate,
        notes: form.notes || null,
        createdAt: created?.createdAt ?? new Date().toISOString(),
        createdBy: currentUserId,
        participants: calculateEqualShares(amountPaise, participantIds).map((s) => ({
          id: `optimistic-${s.userId}`,
          userId: s.userId,
          shareAmount: s.shareAmount,
          creditApplied: 0,
          creditConfirmed: false,
        })),
      };
      setOpen(false);
      setForm({ title: "", amount: "", category: "OTHER", paidBy: currentUserId, expenseDate: new Date().toISOString().split("T")[0], notes: "" });
      setParticipantIds(members.map((m) => m.id));
      // The optimistic insert must share the refresh transition: it stays
      // visible exactly until the refreshed server data replaces it.
      startTransition(() => {
        onOptimisticAdd?.(optimistic);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="btn-gold gap-2">
        <Plus className="h-4 w-4" />
        <span className="sm:hidden">Add</span>
        <span className="hidden sm:inline">Add Expense</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add an expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Electricity bill" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" placeholder="0.00" step="0.01" min="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v ?? form.category })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Paid by</Label>
                <Select value={form.paidBy} onValueChange={(v) => setForm({ ...form, paidBy: v ?? form.paidBy })}>
                  <SelectTrigger><SelectValue placeholder="Select member">{memberMap.get(form.paidBy)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Split among</Label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleParticipant(m.id)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      participantIds.includes(m.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any details…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="btn-gold">
                {loading ? "Adding…" : "Add Expense"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
