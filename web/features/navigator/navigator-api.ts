import type { BriefRejection } from "@/infrastructure/brief-text";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { EngineError, SearchRequest } from "@/infrastructure/engine-types";

export type BriefInput = { kind: "text"; text: string } | { kind: "pdf"; file: File };

export type NavigatorFailure =
  | { kind: "engine"; error: EngineError }
  | { kind: "brief"; reason: BriefRejection }
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
];
const engineErrors: readonly EngineError[] = ["bad_request", "not_found", "engine_error"];

function failureFrom(body: unknown): NavigatorFailure {
  const { error, reason } = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const rejection = briefRejections.find((known) => known === reason);
  if (rejection) return { kind: "brief", reason: rejection };
  return { kind: "engine", error: engineErrors.find((known) => known === error) ?? "engine_error" };
}

async function send(path: string, init: RequestInit): Promise<NavigatorOutcome> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, method: "POST" });
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || body === null) return { ok: false, failure: failureFrom(body) };
  // The route checked this body against contracts/result.schema.json before sending it.
  return { ok: true, response: body as SearchResponse };
}

export const httpNavigatorApi: NavigatorApi = {
  search: (request) =>
    send("/api/search", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  brief: (input) => {
    const form = new FormData();
    if (input.kind === "pdf") form.set("file", input.file);
    else form.set("text", input.text);
    return send("/api/brief", { body: form });
  },
};
