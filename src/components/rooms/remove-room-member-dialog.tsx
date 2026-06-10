"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

interface RemoveRoomMemberDialogProps {
  roomId: string;
  memberId: string;
  memberName: string;
  memberBalance: number;
  unsettledCount: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveRoomMemberDialog({
  roomId,
  memberId,
  memberName,
  memberBalance,
  unsettledCount,
  isOpen,
  onOpenChange,
}: RemoveRoomMemberDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleRemove() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to remove member");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Remove {memberName}?
          </DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2">⚠️ Before removing:</p>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>• Member will lose access to this room</li>
              <li>• All expenses remain in history</li>
              <li>• Activity log preserved</li>
            </ul>
          </div>

          {memberBalance !== 0 && (
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
              <p className="text-xs font-semibold text-rose-900">Balance:</p>
              <p className={`text-sm font-bold mt-1 ${memberBalance > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {memberBalance > 0 ? `+${formatCurrency(memberBalance)}` : `-${formatCurrency(Math.abs(memberBalance))}`}
              </p>
            </div>
          )}

          {unsettledCount > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-semibold text-blue-900">
                Unsettled: {unsettledCount} expense{unsettledCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={isLoading}>
            {isLoading ? "Removing..." : "Remove Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
