// The two requests the panel makes, both to this app's own routes: /api/agent for Bärnli, and
// /api/search for the plain answer when Bärnli cannot give one. A 404 (the route's `not_found`
// marker, or Next's own page while the route does not exist yet) means Bärnli is not connected.
import { parseSearchResponse } from "@/infrastructure/contract";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { type AgentReply, parseAgentReply } from "./agent-reply";

export type ChatMessage = { readonly role: "user" | "assistant"; readonly content: string };

export type LumiFailure =
  "not_connected" | "bad_request" | "rate_limited" | "engine_error" | "network" | "malformed";

export type Outcome<T> = { ok: true; value: T } | { ok: false; failure: LumiFailure };

export type LumiApi = {
  ask(messages: readonly ChatMessage[]): Promise<Outcome<AgentReply>>;
  search(query: string): Promise<Outcome<SearchResponse>>;
};

type Fetch = (path: string, init: RequestInit) => Promise<Response>;

async function failureOf(response: Response): Promise<LumiFailure> {
  if (response.status === 404) return "not_connected";
  const body: unknown = await response.json().catch(() => null);
  const marker = typeof body === "object" && body !== null && "error" in body ? body.error : null;
  return marker === "bad_request" || marker === "rate_limited" ? marker : "engine_error";
}

async function post<T>(
  fetchFrom: Fetch,
  path: string,
  body: unknown,
  parse: (body: unknown) => T | null,
): Promise<Outcome<T>> {
  let response: Response;
  try {
    response = await fetchFrom(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, failure: "network" };
  }
  if (!response.ok) return { ok: false, failure: await failureOf(response) };
  const value = parse(await response.json().catch(() => null));
  return value === null ? { ok: false, failure: "malformed" } : { ok: true, value };
}

export function createHttpLumiApi(fetchFrom: Fetch): LumiApi {
  return {
    ask: (messages) => post(fetchFrom, "/api/agent", { messages }, parseAgentReply),
    search: (query) => post(fetchFrom, "/api/search", { query }, parseSearchResponse),
  };
}

export const httpLumiApi: LumiApi = createHttpLumiApi((path, init) => fetch(path, init));
