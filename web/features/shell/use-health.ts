"use client";

import { useEffect, useState } from "react";
import type { Health } from "@/infrastructure/contract-types.generated";

// Asked once after the world is on screen, so the shell never waits for the engine. A failed or
// missing answer leaves the HUD without counts.
export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        // The route checked this body against contracts/health.schema.json before sending it.
        if (!cancelled && body !== null) setHealth(body as Health);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return health;
}
