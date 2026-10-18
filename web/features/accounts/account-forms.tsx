"use client";

import { type FormEvent, type ReactNode, useId } from "react";
import type { JoinInput, SignInInput } from "./account-api";

const field = "bg-chip rounded-pill placeholder:text-muted w-full px-5 py-3";
const submitButton =
  "bg-primary text-primary-ink rounded-pill px-5 py-3 font-bold disabled:opacity-60";

// Read through form.elements rather than FormData: the same in every browser and in the tests.
function values(
  event: FormEvent<HTMLFormElement>,
  names: readonly string[],
): Record<string, string> {
  event.preventDefault();
  const form = event.currentTarget;
  return Object.fromEntries(
    names.map((name) => {
      const element = form.elements.namedItem(name);
      return [name, element instanceof HTMLInputElement ? element.value : ""];
    }),
  );
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

export function JoinForm({ busy, onJoin }: { busy: boolean; onJoin: (input: JoinInput) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    const {
      invite = "",
      handle = "",
      displayName = "",
      password = "",
    } = values(event, ["invite", "handle", "displayName", "password"]);
    onJoin({ invite, handle, displayName, password });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Join with an invite">
      <Field label="Invite code">
        {(id) => (
          <input id={id} name="invite" required autoComplete="one-time-code" className={field} />
        )}
      </Field>
      <Field label="Handle">
        {(id) => (
          <input
            id={id}
            name="handle"
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            className={field}
          />
        )}
      </Field>
      <Field label="Display name">
        {(id) => (
          <input
            id={id}
            name="displayName"
            required
            maxLength={60}
            autoComplete="name"
            className={field}
          />
        )}
      </Field>
      <Field label="Password (at least 12 characters)">
        {(id) => (
          <input
            id={id}
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={field}
          />
        )}
      </Field>
      <p className="text-muted text-sm">
        No email is asked for. Your profile stays private until you change it.
      </p>
      <button type="submit" disabled={busy} className={submitButton}>
        Join Bern Life
      </button>
    </form>
  );
}

export function SignInForm({
  busy,
  onSignIn,
}: {
  busy: boolean;
  onSignIn: (input: SignInInput) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    const { handle = "", password = "" } = values(event, ["handle", "password"]);
    onSignIn({ handle, password });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Sign in">
      <Field label="Handle">
        {(id) => <input id={id} name="handle" required autoComplete="username" className={field} />}
      </Field>
      <Field label="Password">
        {(id) => (
          <input
            id={id}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={field}
          />
        )}
      </Field>
      <button type="submit" disabled={busy} className={submitButton}>
        Sign in
      </button>
    </form>
  );
}

export function DeleteAccountForm({
  busy,
  onDelete,
}: {
  busy: boolean;
  onDelete: (password: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    onDelete(values(event, ["password"]).password ?? "");
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Delete my account">
      <p className="text-muted text-sm">
        This deletes your account, profile, sessions and messages, for everyone, and cannot be
        undone.
      </p>
      <Field label="Your password, to confirm">
        {(id) => (
          <input
            id={id}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={field}
          />
        )}
      </Field>
      <button
        type="submit"
        disabled={busy}
        className="bg-warn-bg text-warn-ink rounded-pill px-5 py-3 font-bold"
      >
        Delete everything
      </button>
    </form>
  );
}
