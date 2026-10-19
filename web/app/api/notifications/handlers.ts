// Your in-app notifications: the list, marking them read, and whether you get them at all. Push
// and email are not built, so nothing here sends anything outside the app.
import {
  LIST_MAX,
  inAppOn,
  markRead,
  notificationsOf,
  setInApp,
} from "@/features/notifications/server-store";
import { inboxItem } from "@/features/notifications/server-view";
import { type MemberRouteDeps, admittedFor, failure, jsonBody, signedInFor } from "../member-route";

export const NOTIFICATION_LIMITS = {
  read: { key: "notifications:read", max: 120 },
  preferences: { key: "notifications:preferences", max: 20 },
} as const;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `{ all: true }`, or `{ ids: [...] }` with one to 50 notification ids. */
export function parseRead(body: unknown): readonly string[] | "all" | null {
  const fields = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (fields.all === true) return "all";
  const { ids } = fields;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > LIST_MAX) return null;
  return ids.every((id): id is string => typeof id === "string" && ID.test(id)) ? ids : null;
}

export function parsePreferences(body: unknown): { inApp: boolean } | null {
  const inApp = (body as { inApp?: unknown } | null)?.inApp;
  return typeof inApp === "boolean" ? { inApp } : null;
}

export async function listNotifications(
  request: Request,
  deps: MemberRouteDeps,
): Promise<Response> {
  const signedIn = await signedInFor(request, deps);
  if (!signedIn.ok) return signedIn.response;
  const stored = await notificationsOf(deps.sql, signedIn.user.id);
  const notifications = stored.flatMap((item) => inboxItem(item) ?? []);
  return Response.json({ notifications });
}

export async function readNotifications(
  request: Request,
  deps: MemberRouteDeps,
): Promise<Response> {
  const admitted = await admittedFor(request, deps, NOTIFICATION_LIMITS.read);
  if (!admitted.ok) return admitted.response;
  const ids = parseRead(await jsonBody(request));
  if (ids === null) return failure("bad_request");
  await markRead(deps.sql, admitted.user.id, ids, admitted.now);
  return new Response(null, { status: 204 });
}

export async function getPreferences(request: Request, deps: MemberRouteDeps): Promise<Response> {
  const signedIn = await signedInFor(request, deps);
  if (!signedIn.ok) return signedIn.response;
  return Response.json({ inApp: await inAppOn(deps.sql, signedIn.user.id) });
}

export async function putPreferences(request: Request, deps: MemberRouteDeps): Promise<Response> {
  const admitted = await admittedFor(request, deps, NOTIFICATION_LIMITS.preferences);
  if (!admitted.ok) return admitted.response;
  const preferences = parsePreferences(await jsonBody(request));
  if (preferences === null) return failure("bad_request");
  await setInApp(deps.sql, admitted.user.id, preferences.inApp, admitted.now);
  return Response.json(preferences);
}
