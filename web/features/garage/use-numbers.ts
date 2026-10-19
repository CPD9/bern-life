"use client";

import { useEffect, useRef, useState } from "react";
import type { GarageApi, NumbersOutcome } from "./numbers-api";

export type NumbersState = { readonly status: "loading" } | NumbersOutcome;

const LOADING: NumbersState = { status: "loading" };
const ERROR: NumbersState = { status: "error" };

// Asked once when the garage opens and again only when the player chooses Try again.
export function useNumbers(api: GarageApi): { state: NumbersState; retry: () => void } {
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

/** Calls `callback` the first time `when` is true, and never again while mounted. */
export function useOnce(when: boolean, callback: (() => void) | undefined): void {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    callback?.();
  }, [when, callback]);
}
