// The browser's side of /api/messages/*. Components take a MessagesApi, so tests pass a fake and
// the app passes httpMessagesApi.
import type { Start } from "./input";
import type { ConversationSummary, MessagePage, MessageView } from "./types";

export type MessagesFailure =
  "unauthenticated" | "not_found" | "unknown_handle" | "bad_request" | "network";
export type MessagesOutcome<T> = { ok: true; value: T } | { ok: false; failure: MessagesFailure };
export type Fetch = (path: string, init: RequestInit) => Promise<Response>;

export interface MessagesApi {
  conversations(): Promise<MessagesOutcome<ConversationSummary[]>>;
  start(start: Start): Promise<MessagesOutcome<string>>;
  page(conversationId: string, before: string | null): Promise<MessagesOutcome<MessagePage>>;
  post(conversationId: string, body: string): Promise<MessagesOutcome<MessageView>>;
  remove(conversationId: string, messageId: string): Promise<MessagesOutcome<null>>;
  markRead(conversationId: string): Promise<MessagesOutcome<null>>;
  unread(): Promise<MessagesOutcome<number>>;
}

const KNOWN: readonly MessagesFailure[] = [
  "unauthenticated",
  "not_found",
  "unknown_handle",
  "bad_request",
];

async function call<T>(
  send: Fetch,
  path: string,
  method: string,
  body?: unknown,
): Promise<MessagesOutcome<T>> {
  try {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
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

function pick<T, K extends keyof T>(outcome: MessagesOutcome<T>, key: K): MessagesOutcome<T[K]> {
  return outcome.ok ? { ok: true, value: outcome.value[key] } : outcome;
}

export function messagesApiOver(send: Fetch): MessagesApi {
  const base = "/api/messages/conversations";
  return {
    conversations: async () =>
      pick(
        await call<{ conversations: ConversationSummary[] }>(send, base, "GET"),
        "conversations",
      ),
    start: async (start) => pick(await call<{ id: string }>(send, base, "POST", start), "id"),
    page: (id, before) =>
      call<MessagePage>(send, `${base}/${id}/messages${before ? `?before=${before}` : ""}`, "GET"),
    post: async (id, body) =>
      pick(
        await call<{ message: MessageView }>(send, `${base}/${id}/messages`, "POST", { body }),
        "message",
      ),
    remove: (id, messageId) => call<null>(send, `${base}/${id}/messages/${messageId}`, "DELETE"),
    markRead: (id) => call<null>(send, `${base}/${id}/read`, "POST"),
    unread: async () =>
      pick(await call<{ unread: number }>(send, "/api/messages/unread", "GET"), "unread"),
  };
}

export const httpMessagesApi: MessagesApi = messagesApiOver((path, init) => fetch(path, init));

export const FAILURE_TEXT: Record<MessagesFailure, string> = {
  unauthenticated: "Sign in to use Messages.",
  not_found: "That conversation is not there, or you are not in it.",
  unknown_handle: "Nobody has that handle. Check the spelling, without the @.",
  bad_request: "Check the message: it can be up to 4,000 characters and cannot be empty.",
  network: "The server could not be reached. Try again in a moment.",
};
