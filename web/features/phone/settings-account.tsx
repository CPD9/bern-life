"use client";

import { useEffect, useState } from "react";
import { Button } from "@/infrastructure/ui/button";
import { type Choice, ChoiceRow } from "./choice-row";
import type { AccountLoad, ProfileApi, ProfileSave, ProfileVisibility } from "./profile-api";

const visibilityChoices: readonly Choice<ProfileVisibility>[] = [
  { value: "private", label: "Only me" },
  { value: "members", label: "Members" },
];

const saveText: Record<ProfileSave, string> = {
  saved: "Saved.",
  "signed-out": "You are signed out. Sign in again to change this.",
  "not-connected": "Saving your profile is not connected yet.",
  failed: "Not saved: the server could not be reached. Try again.",
};

type AccountSettingsProps = { api: ProfileApi; signInHref: string };

export function AccountSettings({ api, signInHref }: AccountSettingsProps) {
  const [load, setLoad] = useState<AccountLoad | { status: "loading" }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<ProfileSave | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void api.load().then((next) => {
      if (current) setLoad(next);
    });
    return () => {
      current = false;
    };
  }, [api, attempt]);

  if (load.status === "loading")
    return <p className="text-muted text-sm">Checking your account.</p>;
  if (load.status === "signed-out") {
    return (
      <p className="text-sm">
        You are not signed in, so there is no profile to show.{" "}
        <a href={signInHref} className="text-primary font-bold underline">
          Sign in
        </a>
      </p>
    );
  }
  if (load.status === "not-connected") {
    return <p className="text-sm">Account settings are not connected yet.</p>;
  }
  if (load.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm">Your account could not be loaded.</p>
        <Button
          onClick={() => {
            setLoad({ status: "loading" });
            setAttempt((count) => count + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const { account } = load;
  const visibility = account.profile?.visibility ?? "private";
  const choices =
    visibility === "public"
      ? [...visibilityChoices, { value: "public" as const, label: "Public" }]
      : visibilityChoices;

  async function change(next: ProfileVisibility) {
    const profile = {
      role: account.profile?.role ?? null,
      goal: account.profile?.goal ?? null,
      expertise: account.profile?.expertise ?? [],
      avatar: account.profile?.avatar ?? null,
      visibility: next,
    };
    setBusy(true);
    setSaved(null);
    const outcome = await api.save(profile);
    setBusy(false);
    setSaved(outcome);
    if (outcome === "saved") setLoad({ status: "signed-in", account: { ...account, profile } });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Signed in as <span className="font-bold">{account.displayName}</span>{" "}
        <span className="text-muted">@{account.handle}</span>
      </p>
      <ChoiceRow
        title="Who sees your profile"
        description="Only me keeps it to you. Members are people who joined Bern Life."
        choices={choices}
        value={visibility}
        onChange={(next) => void change(next)}
        disabled={busy}
      />
      <p aria-live="polite" className="text-muted min-h-5 text-sm">
        {saved && saveText[saved]}
      </p>
    </div>
  );
}
