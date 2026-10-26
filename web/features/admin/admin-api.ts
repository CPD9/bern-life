// The browser's side of the Admin app: the engine's health and sources, which every member may
// read, and the two admin routes. The app takes an AdminApi, so tests pass fakes and the app
// passes httpAdminApi. A refusal is kept apart from an error, because the app says something
// different for each: who you are, what is not connected, what failed.
import {
  parseAdminActivity,
  parseAdminFlagged,
  parseHealth,
  parseSourcesList,
} from "@/infrastructure/contract";
import type {
  AdminActivity,
  AdminFlagged,
  Health,
  SourcesList,
} from "@/infrastructure/contract-types.generated";

export type AdminRefusal = "signed_out" | "forbidden" | "not_connected" | "error";

export type AdminOutcome<T> =
  { readonly status: "ok"; readonly value: T } | { readonly status: AdminRefusal };

export type AdminApi = {
  health(): Promise<AdminOutcome<Health>>;
  sources(): Promise<AdminOutcome<SourcesList>>;
  activity(): Promise<AdminOutcome<AdminActivity>>;
  flagged(): Promise<AdminOutcome<AdminFlagged>>;
};

const REFUSED: Readonly<Record<number, AdminRefusal>> = {
  401: "signed_out",
  403: "forbidden",
  404: "not_connected",
};

export async function readAdmin<T>(
  fetchIt: () => Promise<Response>,
  parse: (body: unknown) => T | null,
): Promise<AdminOutcome<T>> {
  let response: Response;
  try {
    response = await fetchIt();
  } catch {
    return { status: "error" };
  }
  const refusal = REFUSED[response.status];
  if (refusal !== undefined) return { status: refusal };
  if (!response.ok) return { status: "error" };
  const value = parse(await response.json().catch(() => null));
  return value === null ? { status: "error" } : { status: "ok", value };
}

export const httpAdminApi: AdminApi = {
  health: () => readAdmin(() => fetch("/api/health"), parseHealth),
  sources: () => readAdmin(() => fetch("/api/sources"), parseSourcesList),
  activity: () => readAdmin(() => fetch("/api/admin/activity"), parseAdminActivity),
  flagged: () => readAdmin(() => fetch("/api/admin/flagged"), parseAdminFlagged),
};
