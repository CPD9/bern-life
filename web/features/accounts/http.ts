// The auth routes' shared edges: the origin check, error markers with their status codes, and
// the session cookie. Responses carry the user's id, handle and display name, nothing more.
import { db } from "@/infrastructure/db";
import { accountsEnv } from "@/infrastructure/env";
import {
  clearedSessionCookie,
  fromOwnOrigin,
  sessionCookie,
  sessionToken,
} from "@/infrastructure/session";
import { currentUser, type AccountError, type SignedIn } from "./accounts";
import type { User } from "./store";

type Marker = AccountError | "forbidden";

const STATUS: Record<Marker, number> = {
  bad_request: 400,
  invite_invalid: 400,
  invalid_credentials: 401,
  unauthenticated: 401,
  forbidden: 403,
  handle_taken: 409,
  rate_limited: 429,
};

export function failure(marker: Marker): Response {
  return Response.json({ error: marker }, { status: STATUS[marker] });
}

/** A state-changing request from any origin but the app's own is refused before it is read. */
export function crossSite(request: Request, appOrigin = accountsEnv().appOrigin): Response | null {
  return fromOwnOrigin(request, appOrigin) ? null : failure("forbidden");
}

export async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export function signedIn({ user, token }: SignedIn, appOrigin = accountsEnv().appOrigin): Response {
  return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(token, appOrigin) } });
}

export function signedOut(appOrigin = accountsEnv().appOrigin): Response {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearedSessionCookie(appOrigin) },
  });
}

/** The signed-in user behind the request's session cookie, or null. */
export async function requestUser(request: Request): Promise<User | null> {
  return currentUser(db(), sessionToken(request), new Date());
}
