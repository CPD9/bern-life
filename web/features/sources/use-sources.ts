"use client";

import { useEffect, useState } from "react";
import type { SourcesApi, SourcesOutcome } from "./sources-api";

export type SourcesState = { readonly status: "loading" } | SourcesOutcome;

const LOADING: SourcesState = { status: "loading" };
const ERROR: SourcesState = { status: "error" };

// Asked once when the app opens and again only when the player chooses Try again.
export function useSources(api: SourcesApi): { state: SourcesState; retry: () => void } {
  const [state, setState] = useState<SourcesState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void api
      .list()
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
