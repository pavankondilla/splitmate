"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteRoomDialogProps {
  roomId: string;
  roomName: string;
  memberCount: number;
  expenseCount: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRoomDialog({
  roomId,
  roomName,
  memberCount,
  expenseCount,
  isOpen,
  onOpenChange,
}: DeleteRoomDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleDelete() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete room");
        return;
      }

      onOpenChange(false);
      router.push("/dashboard");
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
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Delete &ldquo;{roomName}&rdquo;?
          </DialogTitle>
          <DialogDescription>
            This will permanently close the room for all members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-red-50 border border-red-100 p-3 space-y-1">
            <p className="text-xs font-semibold text-red-900 mb-2">What happens:</p>
            <ul className="text-xs text-red-800 space-y-1">
              <li>• All {memberCount} member{memberCount !== 1 ? "s" : ""} will lose access</li>
              <li>• {expenseCount} expense{expenseCount !== 1 ? "s" : ""} will no longer be visible</li>
              <li>• Balances and settlements will be hidden</li>
              <li>• This cannot be undone</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading} className="gap-2">
            <Trash2 className="h-4 w-4" />
            {isLoading ? "Deleting..." : "Delete Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
