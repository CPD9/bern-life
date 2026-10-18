"use client";

import { useState } from "react";
import { FAILURE_TEXT, type AccountApi } from "./account-api";
import { DeleteAccountForm, JoinForm, SignInForm } from "./account-forms";
import { type AccountController, useAccount } from "./use-account";

type Mode = "join" | "sign-in";

export function AccountScreen({ controller }: { controller: AccountController }) {
  const [mode, setMode] = useState<Mode>("join");
  const { state, failure, busy } = controller;

  const notice =
    failure === null ? null : (
      <p role="alert" className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3">
        {FAILURE_TEXT[failure]}
      </p>
    );

  if (state.status === "checking") {
    return (
      <p role="status" className="text-muted">
        Checking whether you are signed in…
      </p>
    );
  }

  if (state.status === "signed-in") {
    return (
      <section className="flex flex-col gap-4" aria-label="Your account">
        <p role="status" className="text-lg">
          Signed in as <strong>{state.user.displayName}</strong>{" "}
          <span className="text-muted">@{state.user.handle}</span>
        </p>
        <button
          type="button"
          onClick={() => void controller.signOut()}
          className="bg-chip rounded-pill self-start px-5 py-3 font-bold"
        >
          Sign out
        </button>
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer font-bold">Delete my account</summary>
          <DeleteAccountForm
            busy={busy}
            onDelete={(password) => void controller.deleteAccount(password)}
          />
        </details>
        {notice}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-label="Join or sign in">
      <div className="flex gap-2" role="group" aria-label="Choose">
        {(["join", "sign-in"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className="rounded-pill bg-chip aria-pressed:bg-chip-selected aria-pressed:text-chip-selected-ink px-4 py-2 font-bold"
          >
            {option === "join" ? "Join with an invite" : "Sign in"}
          </button>
        ))}
      </div>
      {mode === "join" ? (
        <JoinForm busy={busy} onJoin={(input) => void controller.join(input)} />
      ) : (
        <SignInForm busy={busy} onSignIn={(input) => void controller.signIn(input)} />
      )}
      {notice}
    </section>
  );
}

export function StandaloneAccount({ api }: { api: AccountApi }) {
  return <AccountScreen controller={useAccount(api)} />;
}
