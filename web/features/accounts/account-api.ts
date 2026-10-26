// The browser's side of /api/auth/*. Components take an AccountApi, so tests pass a fake and the
// app passes httpAccountApi. The session cookie is HttpOnly: this code never sees the token.
export type AccountRole = "member" | "admin";
export type AccountUser = { id: string; handle: string; displayName: string; role: AccountRole };
export type AccountFailure =
  | "bad_request"
  | "invalid_credentials"
  | "invite_invalid"
  | "handle_taken"
  | "rate_limited"
  | "unauthenticated"
  | "network";
export type AccountOutcome<T> = { ok: true; value: T } | { ok: false; failure: AccountFailure };
export type JoinInput = { invite: string; handle: string; displayName: string; password: string };
export type SignInInput = { handle: string; password: string };

export interface AccountApi {
  me(): Promise<AccountOutcome<AccountUser>>;
  join(input: JoinInput): Promise<AccountOutcome<AccountUser>>;
  signIn(input: SignInInput): Promise<AccountOutcome<AccountUser>>;
  signOut(): Promise<void>;
  deleteAccount(password: string): Promise<AccountOutcome<null>>;
}

const KNOWN: readonly AccountFailure[] = [
  "bad_request",
  "invalid_credentials",
  "invite_invalid",
  "handle_taken",
  "rate_limited",
  "unauthenticated",
];

export type Fetch = (path: string, init: RequestInit) => Promise<Response>;

async function call(
  send: Fetch,
  path: string,
  method: string,
  body?: unknown,
): Promise<AccountOutcome<unknown>> {
  try {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    const response = await send(path, init);
    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (response.ok) return { ok: true, value: payload };
    const marker = (payload as { error?: unknown } | null)?.error;
    const failure = KNOWN.find((known) => known === marker) ?? "network";
    return { ok: false, failure };
  } catch {
    return { ok: false, failure: "network" };
  }
}

function user(outcome: AccountOutcome<unknown>): AccountOutcome<AccountUser> {
  if (!outcome.ok) return outcome;
  return { ok: true, value: (outcome.value as { user: AccountUser }).user };
}

/** The API over HTTP; tests pass their own fetch, the app uses the browser's. */
export function accountApiOver(send: Fetch): AccountApi {
  return {
    me: async () => user(await call(send, "/api/auth/me", "GET")),
    join: async (input) => user(await call(send, "/api/auth/sign-up", "POST", input)),
    signIn: async (input) => user(await call(send, "/api/auth/sign-in", "POST", input)),
    signOut: async () => {
      await call(send, "/api/auth/sign-out", "POST");
    },
    deleteAccount: async (password) => {
      const outcome = await call(send, "/api/auth/me", "DELETE", { password });
      return outcome.ok ? { ok: true, value: null } : outcome;
    },
  };
}

export const httpAccountApi: AccountApi = accountApiOver((path, init) => fetch(path, init));

/** What each refusal means, in a sentence a person can act on. */
export const FAILURE_TEXT: Record<AccountFailure, string> = {
  bad_request:
    "Check the fields: a handle is 3 to 20 lowercase letters, digits or _, and a password has at least 12 characters.",
  invalid_credentials: "That handle and password do not match an account.",
  invite_invalid:
    "That invite code is not known on this site or has expired. A code works once, for 7 days, on the site that made it.",
  handle_taken: "That handle is taken. Pick another.",
  rate_limited: "Too many attempts. Wait 5 minutes, then try again.",
  unauthenticated: "You are signed out. Sign in again.",
  network: "The server could not be reached. Try again in a moment.",
};
