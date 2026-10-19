// Who may make the engine call a model. Every request is answered from the recorded calls unless a
// signed-in person under their own live limit sent it from the app's own pages, so nobody else can
// spend the model budget, and a limit per address keeps anyone from flooding the engine. When the
// limiter's database fails the answer is cache-only, not an error page: declining to call the model
// is always safe.
import { currentUser } from "@/features/accounts/accounts";
import { attempts, recordAttempt } from "@/features/accounts/rate-limit";
import { db, type Sql } from "./db";
import { ENGINE_LIMITS } from "./engine-limits";
import { accountsEnv, env } from "./env";
import { clientIp, fromOwnOrigin, sessionToken } from "./session";

export type EngineRoute = "search" | "brief" | "agent";

export type EngineAccess =
  | { readonly ok: true; readonly live: boolean }
  | { readonly ok: false; readonly response: Response };

type GuardDeps = {
  readonly demoFixtures: boolean;
  readonly clientIp: (request: Request) => string;
  readonly fromOwnOrigin: (request: Request) => boolean;
  readonly userId: (request: Request, now: Date) => Promise<string | null>;
  /** Records one attempt on the key and returns its attempts in the window, this one included. */
  readonly countAttempt: (key: string, now: Date) => Promise<number>;
  readonly now: () => Date;
  readonly logError: (message: string, cause: unknown) => void;
};

type EngineGuard = (request: Request, route: EngineRoute) => Promise<EngineAccess>;

const CACHE_ONLY: EngineAccess = { ok: true, live: false };

// Counting first and comparing after gives requests in flight together each their own place in
// line, so a burst cannot all read the same count and all pass.
async function admitted(deps: GuardDeps, key: string, limit: number, now: Date): Promise<boolean> {
  return (await deps.countAttempt(key, now)) <= limit;
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
      // The session cookie also rides along on posts from other sites on the same host
      // (SameSite=Lax), and those must not spend anyone's live calls.
      if (!deps.fromOwnOrigin(request)) return CACHE_ONLY;
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

// The upsert locks the key's row until the transaction ends, so a concurrent attempt on the same
// key waits for it, and the count read back is this attempt's own.
export function countAttempt(sql: Sql, key: string, now: Date): Promise<number> {
  return sql.begin(async (tx) => {
    await recordAttempt(tx, key, now);
    return attempts(tx, key, now);
  });
}

function appGuard(): EngineGuard {
  return createEngineGuard({
    demoFixtures: env().demoFixtures,
    clientIp,
    fromOwnOrigin: (request) => fromOwnOrigin(request, accountsEnv().appOrigin),
    userId: async (request, now) =>
      (await currentUser(db(), sessionToken(request), now))?.id ?? null,
    countAttempt: (key, now) => countAttempt(db(), key, now),
    now: () => new Date(),
    logError: (message, cause) => console.error(message, cause),
  });
}

let guard: EngineGuard | undefined;

export async function guardEngine(request: Request, route: EngineRoute): Promise<EngineAccess> {
  guard ??= appGuard();
  return guard(request, route);
}
