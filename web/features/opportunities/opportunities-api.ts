import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { OpportunityRequest } from "./opportunity-request";

/** `not_connected`: the search answered 404, so there is nothing behind it yet. */
export type OpportunitiesFailure = "not_connected" | "bad_request" | "engine_error" | "network";

export type OpportunitiesOutcome =
  { ok: true; response: SearchResponse } | { ok: false; failure: OpportunitiesFailure };

export type OpportunitiesApi = {
  search(request: OpportunityRequest): Promise<OpportunitiesOutcome>;
};

function failureFrom(status: number, body: unknown): OpportunitiesFailure {
  if (status === 404) return "not_connected";
  const error = typeof body === "object" && body !== null ? Reflect.get(body, "error") : null;
  return error === "bad_request" ? "bad_request" : "engine_error";
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export function httpOpportunitiesApi(fetcher: Fetcher): OpportunitiesApi {
  return {
    search: async (request) => {
      let response: Response;
      try {
        response = await fetcher("/api/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        });
      } catch {
        return { ok: false, failure: "network" };
      }
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || body === null) {
        return { ok: false, failure: failureFrom(response.status, body) };
      }
      // The route checked this body against contracts/result.schema.json before sending it.
      return { ok: true, response: body as SearchResponse };
    },
  };
}
