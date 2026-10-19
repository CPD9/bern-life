// Test helpers for the member routes: members with a profile and a real session, and requests
// carrying that session's cookie, from the app's own origin or another one. Sessions are read by
// the same code the app uses, so a test signs in exactly as a browser does.
import { currentUser } from "@/features/accounts/accounts";
import type { User } from "@/features/accounts/store";
import type { Sql } from "@/infrastructure/db";
import { SESSION_COOKIE, newToken, sessionToken, tokenHash } from "@/infrastructure/session";
import type { MemberRouteDeps } from "./member-route";

export const ORIGIN = "http://127.0.0.1:3000";
export const NOW = new Date("2026-10-19T08:00:00Z");

export type TestMember = User & { token: string };

type Visibility = "private" | "members" | "public";

export function testDeps(sql: Sql, now: () => Date = () => NOW): MemberRouteDeps {
  return {
    sql,
    appOrigin: ORIGIN,
    now,
    userOf: (request, at) => currentUser(sql, sessionToken(request), at),
  };
}

export async function member(
  sql: Sql,
  handle: string,
  visibility: Visibility = "members",
): Promise<TestMember> {
  const name = `${handle.charAt(0).toUpperCase()}${handle.slice(1)}`;
  const [user] = await sql<User[]>`insert into app_user (id, handle, display_name)
    values (gen_random_uuid(), ${handle}, ${name})
    returning id, handle, display_name as "displayName"`;
  const created = user as User;
  await sql`insert into user_profile (user_id, visibility) values (${created.id}, ${visibility})`;
  const token = newToken();
  await sql`insert into session (id_hash, user_id, expires_at)
    values (${tokenHash(token)}, ${created.id}, ${new Date(NOW.getTime() + 86_400_000)})`;
  return { ...created, token };
}

type Send = { as?: TestMember | null; body?: unknown; origin?: string; method?: string };

export function request(path: string, { as = null, body, origin = ORIGIN, method }: Send = {}) {
  const headers: Record<string, string> = { origin };
  if (as !== null) headers.cookie = `${SESSION_COOKIE}=${as.token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function json(response: Response): Promise<unknown> {
  return response.status === 204 ? null : response.json();
}
