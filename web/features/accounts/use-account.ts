"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AccountApi,
  AccountFailure,
  AccountOutcome,
  AccountUser,
  JoinInput,
  SignInInput,
} from "./account-api";

export type AccountState =
  { status: "checking" } | { status: "signed-out" } | { status: "signed-in"; user: AccountUser };

export type AccountController = {
  state: AccountState;
  failure: AccountFailure | null;
  busy: boolean;
  join(input: JoinInput): Promise<void>;
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
};

export function useAccount(api: AccountApi): AccountController {
  const [state, setState] = useState<AccountState>({ status: "checking" });
  const [failure, setFailure] = useState<AccountFailure | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    api.me().then((outcome) => {
      if (current)
        setState(
          outcome.ok ? { status: "signed-in", user: outcome.value } : { status: "signed-out" },
        );
    });
    return () => {
      current = false;
    };
  }, [api]);

  const settle = useCallback(async (pending: Promise<AccountOutcome<AccountUser>>) => {
    setBusy(true);
    const outcome = await pending;
    setBusy(false);
    setFailure(outcome.ok ? null : outcome.failure);
    if (outcome.ok) setState({ status: "signed-in", user: outcome.value });
  }, []);

  return {
    state,
    failure,
    busy,
    join: (input) => settle(api.join(input)),
    signIn: (input) => settle(api.signIn(input)),
    signOut: async () => {
      await api.signOut();
      setFailure(null);
      setState({ status: "signed-out" });
    },
    deleteAccount: async (password) => {
      setBusy(true);
      const outcome = await api.deleteAccount(password);
      setBusy(false);
      setFailure(outcome.ok ? null : outcome.failure);
      if (outcome.ok) setState({ status: "signed-out" });
    },
  };
}
