// The edges every members-only route of connections and notifications shares. A change is
// refused unless it comes from the app's own pages (with SameSite=Lax that stops cross-site
// posts), from a signed-in member, and within that member's limit for the window; a refused
// attempt counts too, so a flood stays refused until its window closes. Dependencies are passed
// in, so tests run the handlers against a throwaway database with real sessions.
import { currentUser } from "@/features/accounts/accounts";
import { admit } from "@/features/accounts/rate-limit";
import type { User } from "@/features/accounts/store";
import { type Sql, db } from "@/infrastructure/db";
import { accountsEnv, env, hasDatabase } from "@/infrastructure/env";
import { fromOwnOrigin, sessionToken } from "@/infrastructure/session";

export type MemberRouteDeps = {
  readonly sql: Sql;
  readonly appOrigin: string;
  readonly now: () => Date;
  readonly userOf: (request: Request, now: Date) => Promise<User | null>;
};

type Marker =
  | "bad_request"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "request_exists"
  | "connected"
  | "rate_limited";

const STATUS: Record<Marker, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  request_exists: 409,
  connected: 409,
  rate_limited: 429,
};

export function failure(marker: Marker): Response {
  return Response.json({ error: marker }, { status: STATUS[marker] });
}

export type Admitted = { ok: true; user: User; now: Date } | { ok: false; response: Response };

export async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

/** A read: signed in, nothing else. */
export async function signedInFor(request: Request, deps: MemberRouteDeps): Promise<Admitted> {
  const now = deps.now();
  const user = await deps.userOf(request, now);
  return user === null
    ? { ok: false, response: failure("unauthenticated") }
    : { ok: true, user, now };
}

/** An admin's read: signed in, and the account's role is admin. A member is refused as
 *  forbidden; nothing says more about what the route holds. */
export async function adminFor(request: Request, deps: MemberRouteDeps): Promise<Admitted> {
  const signedIn = await signedInFor(request, deps);
  if (!signedIn.ok) return signedIn;
  if (signedIn.user.role !== "admin") return { ok: false, response: failure("forbidden") };
  return signedIn;
}

/** A change: from the app's own origin, signed in, and within `limit` per member per window. */
export async function admittedFor(
  request: Request,
  deps: MemberRouteDeps,
  limit: { readonly key: string; readonly max: number },
): Promise<Admitted> {
  if (!fromOwnOrigin(request, deps.appOrigin)) return { ok: false, response: failure("forbidden") };
  const signedIn = await signedInFor(request, deps);
  if (!signedIn.ok) return signedIn;
  const key = `${limit.key}:user:${signedIn.user.id}`;
  if (!(await admit(deps.sql, key, limit.max, signedIn.now))) {
    return { ok: false, response: failure("rate_limited") };
  }
  return signedIn;
}

/**
 * True under DEMO_FIXTURES with no DATABASE_URL, as `PORT=3012 DEMO_FIXTURES=1 bun run dev` runs:
 * there are no accounts, so nobody is signed in and the directory holds only the demo members.
 * Without DEMO_FIXTURES a missing database stays an error.
 */
export function withoutAccounts(): boolean {
  return env().demoFixtures && !hasDatabase();
}

export function appMemberDeps(): MemberRouteDeps {
  const sql = db();
  return {
    sql,
    appOrigin: accountsEnv().appOrigin,
    now: () => new Date(),
    userOf: (request, now) => currentUser(sql, sessionToken(request), now),
  };
}
