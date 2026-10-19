// Every proxy to the engine asks this guard first, and only its answer decides whether the call may
// reach a live model (contracts/api.md).
export type EngineRoute = "search" | "brief" | "agent";

export type EngineAccess =
  | { readonly ok: true; readonly live: boolean }
  | { readonly ok: false; readonly response: Response };

type EngineGuard = (request: Request, route: EngineRoute) => Promise<EngineAccess>;

// The live-safety change decides when a request may go live; until then every call is cache-only.
export const guardEngine: EngineGuard = async () => ({ ok: true, live: false });
