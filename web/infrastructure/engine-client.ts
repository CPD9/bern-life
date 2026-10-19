// HTTP client for the engine (contracts/api.md). Every failure collapses to one of the API's
// markers; the underlying error goes to the server log and never into a response.
import {
  parseAgentReply,
  parseHealth,
  parseNumbers,
  parsePlacePeople,
  parseSearchResponse,
  parseSourcesList,
} from "./contract";
import type { EngineCallOptions, EngineClient, EngineError, EngineResult } from "./engine-types";

type Fetch = (url: URL, init?: RequestInit) => Promise<Response>;

type EngineClientOptions = {
  readonly baseUrl: URL;
  readonly fetch: Fetch;
  readonly logError: (message: string, cause?: unknown) => void;
  readonly timeoutMs: number;
  /** For `brief`, the longest call: the model reads the brief, then every need is searched. */
  readonly briefTimeoutMs?: number;
};

type Post = { readonly body: unknown; readonly live: boolean };

function errorForStatus(status: number): EngineError {
  if (status === 400) return "bad_request";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "engine_error";
}

// The engine lets a request reach a model only when this header is present, so it is set from the
// caller's decision alone and never copied from an incoming request.
function post(body: unknown, options: EngineCallOptions | undefined): Post {
  return { body, live: options?.live === true };
}

function postHeaders(live: boolean): Record<string, string> {
  const json = { "content-type": "application/json" };
  return live ? { ...json, "x-bernlife-live": "1" } : json;
}

export function createEngineClient(options: EngineClientOptions): EngineClient {
  async function call<T>(
    path: string,
    parse: (body: unknown) => T | null,
    request?: Post,
    timeoutMs: number = options.timeoutMs,
  ): Promise<EngineResult<T>> {
    const url = new URL(path, options.baseUrl);
    const signal = AbortSignal.timeout(timeoutMs);
    const init: RequestInit =
      request === undefined
        ? { method: "GET", signal }
        : {
            method: "POST",
            headers: postHeaders(request.live),
            body: JSON.stringify(request.body),
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
    search: (request, callOptions) =>
      call("/api/search", parseSearchResponse, post(request, callOptions)),
    brief: (text, callOptions) =>
      call(
        "/api/brief",
        parseSearchResponse,
        post({ text }, callOptions),
        options.briefTimeoutMs ?? options.timeoutMs,
      ),
    agent: (request, callOptions) =>
      call("/api/agent", parseAgentReply, post(request, callOptions)),
    sources: () => call("/api/sources", parseSourcesList),
    placePeople: (sourceId, host) =>
      call(
        `/api/places/${encodeURIComponent(sourceId)}/${encodeURIComponent(host)}/people`,
        parsePlacePeople,
      ),
    numbers: () => call("/api/numbers", parseNumbers),
    health: () => call("/api/health", parseHealth),
  };
}
