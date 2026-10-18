// HTTP client for the engine (contracts/api.md). Every failure collapses to one of the API's
// markers; the underlying error goes to the server log and never into a response.
import { parseHealth, parseSearchResponse } from "./contract";
import type { EngineClient, EngineError, EngineResult } from "./engine-types";

type Fetch = (url: URL, init?: RequestInit) => Promise<Response>;

type EngineClientOptions = {
  readonly baseUrl: URL;
  readonly fetch: Fetch;
  readonly logError: (message: string, cause?: unknown) => void;
  readonly timeoutMs: number;
};

function errorForStatus(status: number): EngineError {
  if (status === 400) return "bad_request";
  if (status === 404) return "not_found";
  return "engine_error";
}

export function createEngineClient(options: EngineClientOptions): EngineClient {
  async function call<T>(
    path: string,
    parse: (body: unknown) => T | null,
    body?: unknown,
  ): Promise<EngineResult<T>> {
    const url = new URL(path, options.baseUrl);
    const signal = AbortSignal.timeout(options.timeoutMs);
    const init: RequestInit =
      body === undefined
        ? { method: "GET", signal }
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal,
          };
    let response: Response;
    try {
      response = await options.fetch(url, init);
    } catch (cause) {
      options.logError(`engine ${path}: request failed`, cause);
      return { ok: false, error: "engine_error" };
    }
    if (!response.ok) {
      options.logError(`engine ${path}: HTTP ${response.status}`);
      return { ok: false, error: errorForStatus(response.status) };
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      options.logError(`engine ${path}: body is not JSON`, cause);
      return { ok: false, error: "engine_error" };
    }
    const value = parse(json);
    if (value === null) {
      options.logError(`engine ${path}: body does not match the contract`);
      return { ok: false, error: "engine_error" };
    }
    return { ok: true, value };
  }

  return {
    search: (request) => call("/api/search", parseSearchResponse, request),
    brief: (text) => call("/api/brief", parseSearchResponse, { text }),
    health: () => call("/api/health", parseHealth),
  };
}
