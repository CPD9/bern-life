import type { BriefRejection } from "@/infrastructure/brief-text";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { EngineError, SearchRequest } from "@/infrastructure/engine-types";

export type BriefInput = { kind: "text"; text: string } | { kind: "pdf"; file: File };

/** Why the engine read no need from a brief (`brief_unread` in contracts/result.schema.json). */
export type BriefUnread = NonNullable<SearchResponse["brief_unread"]>;

export type NavigatorFailure =
  | { kind: "engine"; error: EngineError }
  | { kind: "brief"; reason: BriefRejection }
  | { kind: "unread"; reason: BriefUnread }
  | { kind: "network" };

export type NavigatorOutcome =
  { ok: true; response: SearchResponse } | { ok: false; failure: NavigatorFailure };

export type NavigatorApi = {
  search(request: SearchRequest): Promise<NavigatorOutcome>;
  brief(input: BriefInput): Promise<NavigatorOutcome>;
};

const briefRejections: readonly BriefRejection[] = [
  "empty",
  "too_large",
  "not_pdf",
  "too_many_pages",
  "unreadable",
  "no_text",
  "too_long",
];
const engineErrors: readonly EngineError[] = [
  "bad_request",
  "not_found",
  "rate_limited",
  "engine_error",
];

function failureFrom(body: unknown): NavigatorFailure {
  const { error, reason } = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const rejection = briefRejections.find((known) => known === reason);
  if (rejection) return { kind: "brief", reason: rejection };
  return { kind: "engine", error: engineErrors.find((known) => known === error) ?? "engine_error" };
}

type Fetch = (path: string, init: RequestInit) => Promise<Response>;

async function send(fetchFrom: Fetch, path: string, init: RequestInit): Promise<NavigatorOutcome> {
  let response: Response;
  try {
    response = await fetchFrom(path, { ...init, method: "POST" });
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || body === null) return { ok: false, failure: failureFrom(body) };
  // The route checked this body against contracts/result.schema.json before sending it.
  return { ok: true, response: body as SearchResponse };
}

export function createHttpNavigatorApi(fetchFrom: Fetch): NavigatorApi {
  return {
    search: (request) =>
      send(fetchFrom, "/api/search", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      }),
    brief: (input) => {
      const form = new FormData();
      if (input.kind === "pdf") form.set("file", input.file);
      else form.set("text", input.text);
      return send(fetchFrom, "/api/brief", { body: form });
    },
  };
}

export const httpNavigatorApi: NavigatorApi = createHttpNavigatorApi((path, init) =>
  fetch(path, init),
);
