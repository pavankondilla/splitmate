"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RoomSettingsDialogProps {
  roomId: string;
  roomName: string;
  inviteCode: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomSettingsDialog({
  roomId,
  roomName,
  inviteCode,
  isOpen,
  onOpenChange,
}: RoomSettingsDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(roomName);
  const [renaming, setRenaming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === roomName) return;

    setRenaming(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to rename room");
        return;
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setRenaming(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("This will invalidate the current invite code. Continue?")) return;

    setRegenerating(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_code" }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to regenerate invite code");
        return;
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy() {
    const url = `${window.location.origin}/join?code=${inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            Room Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Rename */}
          <form onSubmit={handleRename} className="space-y-2">
            <Label htmlFor="room-name">Room Name</Label>
            <div className="flex gap-2">
              <Input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Room name"
              />
              <Button
                type="submit"
                size="sm"
                disabled={renaming || !name.trim() || name.trim() === roomName}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {renaming ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>

          <div className="border-t border-gray-100" />

          {/* Invite code */}
          <div className="space-y-2">
            <Label>Invite Code</Label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-sm font-mono bg-gray-100 px-3 py-2 rounded text-gray-800 tracking-widest">
                {inviteCode}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="w-full gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              <RefreshCw className="h-4 w-4" />
              {regenerating ? "Regenerating..." : "Regenerate Code"}
            </Button>
            <p className="text-xs text-gray-400">
              Regenerating will invalidate the current invite link.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
