"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Lock } from "lucide-react";

interface Member { id: string; name: string }

// Shape matching the room page's serialized settlement — shown instantly in
// the Activity list until router.refresh() lands the server data.
export interface OptimisticSettlement {
  id: string;
  payerId: string;
  payeeId: string;
  amount: number;
  note: string | null;
  settledAt: string;
  onBehalfOfAmount: number;
  onBehalfOfUserId: string | null;
}

interface RecordSettlementDialogProps {
  roomId: string;
  members: Member[];
  currentUserId: string;
  prefillPayeeId?: string;
  prefillAmount?: number; // in paise
  // Guided entry points (Settle Now / Pay X proposals) lock payer & payee:
  // proposal confirmation matches the exact payer→payee pair, so editing
  // them here would leave the proposal pending and mint a spurious credit.
  lockParties?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  onOptimisticRecord?: (settlement: OptimisticSettlement) => void;
}

export function RecordSettlementDialog({ roomId, members, currentUserId, prefillPayeeId, prefillAmount, lockParties, triggerLabel, triggerClassName, onOptimisticRecord }: RecordSettlementDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    payerId: currentUserId,
    payeeId: prefillPayeeId ?? "",
    amount: prefillAmount ? (prefillAmount / 100).toString() : "",
    note: "",
  });
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountPaise = Math.round(parseFloat(form.amount) * 100);
    if (isNaN(amountPaise) || amountPaise <= 0) { setError("Enter a valid amount"); return; }
    if (!form.payeeId) { setError("Select who received the payment"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerId: form.payerId, payeeId: form.payeeId, amount: amountPaise, note: form.note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to record settlement");
      }
      const created = await res.json().catch(() => null);
      const optimistic: OptimisticSettlement = {
        id: created?.id ?? `optimistic-${Date.now()}`,
        payerId: form.payerId,
        payeeId: form.payeeId,
        amount: amountPaise,
        note: form.note || null,
        settledAt: created?.settledAt ?? new Date().toISOString(),
        onBehalfOfAmount: 0,
        onBehalfOfUserId: null,
      };
      setOpen(false);
      setForm({ payerId: currentUserId, payeeId: prefillPayeeId ?? "", amount: "", note: "" });
      startTransition(() => {
        onOptimisticRecord?.(optimistic);
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
      <Button variant="outline" onClick={() => setOpen(true)} className={triggerClassName ?? "btn-gold gap-2"}>
        <CheckCircle className="h-4 w-4" />
        {triggerLabel ?? (
          <>
            <span className="sm:hidden">Settle</span>
            <span className="hidden sm:inline">Record Settlement</span>
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record a settlement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {lockParties ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>From (payer)</Label>
                  <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-muted px-3 text-sm text-foreground">
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{memberMap.get(form.payerId)}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>To (receiver)</Label>
                  <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-muted px-3 text-sm text-foreground">
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{memberMap.get(form.payeeId)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>From (payer)</Label>
                  <Select value={form.payerId} onValueChange={(v) => setForm({ ...form, payerId: v ?? form.payerId })}>
                    <SelectTrigger><SelectValue placeholder="Select member">{memberMap.get(form.payerId)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>To (receiver)</Label>
                  <Select value={form.payeeId} onValueChange={(v) => setForm({ ...form, payeeId: v ?? form.payeeId })}>
                    <SelectTrigger><SelectValue placeholder="Select member">{memberMap.get(form.payeeId)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {members.filter((m) => m.id !== form.payerId).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0.00" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. GPay transfer" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="btn-gold">
                {loading ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
