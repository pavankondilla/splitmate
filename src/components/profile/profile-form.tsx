"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

export function ProfileForm({ name, email, avatarUrl }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = displayName.trim() !== name;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to save");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-lg space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-100"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 ring-2 ring-gray-100">
            {initials}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{name}</p>
          <p className="text-sm text-gray-500">{email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Avatar syncs automatically from your sign-in account.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Display name form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <Label htmlFor="display-name" className="text-sm font-medium text-gray-700">
            Display name
          </Label>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">
            This is the name shown on expenses, balances, and the activity feed.
          </p>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              placeholder="Your name"
              className="pl-9"
            />
          </div>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        <Button
          type="submit"
          disabled={saving || !isDirty}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            "Save name"
          )}
        </Button>
      </form>

      <div className="border-t border-gray-100" />

      {/* Read-only email */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={email} readOnly className="pl-9 bg-gray-50 text-gray-500 cursor-default" />
        </div>
        <p className="text-xs text-gray-400">
          Email is managed by your sign-in provider and cannot be changed here.
        </p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Clerk portal link */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 flex items-start gap-3">
        <ExternalLink className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">Password, avatar &amp; security</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Use the account menu in the top-right corner of the screen to manage your password,
            profile photo, and connected accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
