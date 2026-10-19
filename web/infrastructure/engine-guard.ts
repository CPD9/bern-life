// Who may make the engine call a model. Every request is answered from the recorded calls unless a
// signed-in person under their own live limit sent it, so nobody else can spend the model budget,
// and a limit per address keeps anyone from flooding the engine. When the limiter's database fails
// the answer is cache-only, not an error page: declining to call the model is always safe.
import { currentUser } from "@/features/accounts/accounts";
import { attempts, recordAttempt } from "@/features/accounts/rate-limit";
import { db } from "./db";
import { ENGINE_LIMITS } from "./engine-limits";
import { env } from "./env";
import { clientIp, sessionToken } from "./session";

export type EngineRoute = "search" | "brief" | "agent";

export type EngineAccess =
  | { readonly ok: true; readonly live: boolean }
  | { readonly ok: false; readonly response: Response };

type GuardDeps = {
  readonly demoFixtures: boolean;
  readonly clientIp: (request: Request) => string;
  readonly userId: (request: Request, now: Date) => Promise<string | null>;
  readonly attempts: (key: string, now: Date) => Promise<number>;
  readonly recordAttempt: (key: string, now: Date) => Promise<void>;
  readonly now: () => Date;
  readonly logError: (message: string, cause: unknown) => void;
};

type EngineGuard = (request: Request, route: EngineRoute) => Promise<EngineAccess>;

const CACHE_ONLY: EngineAccess = { ok: true, live: false };

/** Counts one more attempt on the key, unless it has reached the limit; says which. */
async function admitted(deps: GuardDeps, key: string, limit: number, now: Date): Promise<boolean> {
  if ((await deps.attempts(key, now)) >= limit) return false;
  await deps.recordAttempt(key, now);
  return true;
}

export function createEngineGuard(deps: GuardDeps): EngineGuard {
  return async (request, route) => {
    if (deps.demoFixtures) return CACHE_ONLY;
    const limits = ENGINE_LIMITS[route];
    const address = deps.clientIp(request);
    const now = deps.now();
    try {
      if (!(await admitted(deps, `engine:${route}:ip:${address}`, limits.perIp, now))) {
        return { ok: false, response: Response.json({ error: "rate_limited" }, { status: 429 }) };
      }
      const userId = await deps.userId(request, now);
      if (userId === null) return CACHE_ONLY;
      const live = await admitted(deps, `engine:${route}:live:${userId}`, limits.livePerUser, now);
      return { ok: true, live };
    } catch (error) {
      deps.logError("engine guard: limiter unavailable, answering from the cache only", error);
      return CACHE_ONLY;
    }
  };
}

function appGuard(): EngineGuard {
  return createEngineGuard({
    demoFixtures: env().demoFixtures,
    clientIp,
    userId: async (request, now) =>
      (await currentUser(db(), sessionToken(request), now))?.id ?? null,
    attempts: (key, now) => attempts(db(), key, now),
    recordAttempt: (key, now) => recordAttempt(db(), key, now),
    now: () => new Date(),
    logError: (message, cause) => console.error(message, cause),
  });
}

let guard: EngineGuard | undefined;

export async function guardEngine(request: Request, route: EngineRoute): Promise<EngineAccess> {
  guard ??= appGuard();
  return guard(request, route);
}
