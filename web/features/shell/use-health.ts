"use client";

import { useEffect, useState } from "react";
import type { Health } from "@/infrastructure/contract-types.generated";

// Asked once after the world is on screen, so the shell never waits for the engine. "waiting" and
// "offline" are told apart so the HUD can say the engine is down instead of just showing nothing.
export type HealthState =
  | { readonly status: "waiting" }
  | { readonly status: "ok"; readonly health: Health }
  | { readonly status: "offline" };

const OFFLINE: HealthState = { status: "offline" };

export async function loadHealth(fetchHealth: () => Promise<Response>): Promise<HealthState> {
  try {
    const response = await fetchHealth();
    if (!response.ok) return OFFLINE;
    // The route checked this body against contracts/health.schema.json before sending it.
    return { status: "ok", health: (await response.json()) as Health };
  } catch {
    return OFFLINE;
  }
}

export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: "waiting" });
  useEffect(() => {
    let cancelled = false;
    void loadHealth(() => fetch("/api/health")).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
