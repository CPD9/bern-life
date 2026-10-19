// The browser's side of /api/people and /api/connections. Components take a ConnectionsApi, so
// tests pass a fake and the app passes httpConnectionsApi. Handles are the only thing that goes in
// a path; a note travels in the body.
import type { Answer } from "./input";
import type { ConnectionView } from "./types";

/** A member as the directory lists them; `demo` only under DEMO_FIXTURES. */
export type Member = {
  handle: string;
  displayName: string;
  role: string | null;
  canVisit: boolean;
  demo?: true;
};

export type ConnectionsFailure =
  | "unauthenticated"
  | "not_found"
  | "request_exists"
  | "connected"
  | "bad_request"
  | "rate_limited"
  | "network";
export type Outcome<T> = { ok: true; value: T } | { ok: false; failure: ConnectionsFailure };
export type Fetch = (path: string, init: RequestInit) => Promise<Response>;

export interface ConnectionsApi {
  people(): Promise<Outcome<Member[]>>;
  requests(): Promise<Outcome<ConnectionView[]>>;
  ask(handle: string, note: string): Promise<Outcome<string>>;
  answer(id: string, answer: Answer): Promise<Outcome<null>>;
  /** Whether you may visit the office now: the route says so again, whatever the list said. */
  office(handle: string): Promise<Outcome<null>>;
}

const KNOWN: readonly ConnectionsFailure[] = [
  "unauthenticated",
  "not_found",
  "request_exists",
  "connected",
  "bad_request",
  "rate_limited",
];

async function call<T>(send: Fetch, path: string, body?: unknown): Promise<Outcome<T>> {
  try {
    const init: RequestInit =
      body === undefined
        ? { method: "GET" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          };
    const response = await send(path, init);
    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (response.ok) return { ok: true, value: payload as T };
    const marker = (payload as { error?: unknown } | null)?.error;
    return { ok: false, failure: KNOWN.find((known) => known === marker) ?? "network" };
  } catch {
    return { ok: false, failure: "network" };
  }
}

function pick<T, K extends keyof T>(outcome: Outcome<T>, key: K): Outcome<T[K]> {
  return outcome.ok ? { ok: true, value: outcome.value[key] } : outcome;
}

export function connectionsApiOver(send: Fetch): ConnectionsApi {
  return {
    people: async () => pick(await call<{ people: Member[] }>(send, "/api/people"), "people"),
    requests: async () =>
      pick(await call<{ requests: ConnectionView[] }>(send, "/api/connections"), "requests"),
    ask: async (handle, note) =>
      pick(await call<{ id: string }>(send, "/api/connections", { handle, note }), "id"),
    answer: (id, answer) => call<null>(send, `/api/connections/${id}`, { answer }),
    office: async (handle) => {
      const outcome = await call<unknown>(send, `/api/people/${encodeURIComponent(handle)}/office`);
      return outcome.ok ? { ok: true, value: null } : outcome;
    },
  };
}

export const httpConnectionsApi: ConnectionsApi = connectionsApiOver((path, init) =>
  fetch(path, init),
);

export const FAILURE_TEXT: Record<ConnectionsFailure, string> = {
  unauthenticated: "Sign in to connect with members.",
  not_found: "That member or request is not there any more.",
  request_exists: "There is already a request between you two. Check your requests.",
  connected: "You are already connected.",
  bad_request: "Check the note: it can be up to 280 characters.",
  rate_limited: "That was a lot at once. Wait a few minutes and try again.",
  network: "The server could not be reached. Try again in a moment.",
};
