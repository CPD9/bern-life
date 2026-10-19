"use client";

import { useEffect, useState } from "react";
import type { NumbersApi, NumbersOutcome } from "./numbers-api";

export type NumbersState = { readonly status: "loading" } | NumbersOutcome;

const LOADING: NumbersState = { status: "loading" };
const ERROR: NumbersState = { status: "error" };

// Asked once when the Garage or the Agents app opens, and again only when the player chooses
// Try again.
export function useNumbers(api: NumbersApi): { state: NumbersState; retry: () => void } {
  const [state, setState] = useState<NumbersState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void api
      .numbers()
      .catch(() => ERROR)
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);
  return {
    state,
    retry: () => {
      setState(LOADING);
      setAttempt((count) => count + 1);
    },
  };
}
