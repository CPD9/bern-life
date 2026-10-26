"use client";

import { useEffect, useState } from "react";
import type {
  AdminActivity,
  AdminFlagged,
  Health,
  SourcesList,
} from "@/infrastructure/contract-types.generated";
import type { AdminApi, AdminOutcome } from "./admin-api";

export type Loaded<T> = { readonly status: "loading" } | AdminOutcome<T>;

export type AdminState = {
  readonly health: Loaded<Health>;
  readonly sources: Loaded<SourcesList>;
  readonly activity: Loaded<AdminActivity>;
  readonly flagged: Loaded<AdminFlagged>;
};

const LOADING = { status: "loading" } as const;
const ERROR = { status: "error" } as const;

const EMPTY: AdminState = {
  health: LOADING,
  sources: LOADING,
  activity: LOADING,
  flagged: LOADING,
};

// The four reads go out together when the app opens, and again only on Try again; each settles
// on its own, so a slow engine route never holds the others back.
export function useAdmin(api: AdminApi): { state: AdminState; retry: () => void } {
  const [state, setState] = useState<AdminState>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    function settle<K extends keyof AdminState>(key: K, read: Promise<AdminState[K]>) {
      void read
        .catch(() => ERROR)
        .then((outcome) => {
          if (!cancelled) setState((current) => ({ ...current, [key]: outcome }));
        });
    }
    settle("health", api.health());
    settle("sources", api.sources());
    settle("activity", api.activity());
    settle("flagged", api.flagged());
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);
  return {
    state,
    retry: () => {
      setState(EMPTY);
      setAttempt((count) => count + 1);
    },
  };
}
