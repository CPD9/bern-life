import type {
  AgentReply,
  Health,
  Numbers,
  Profile,
  SearchResponse,
  SourcesList,
} from "./contract-types.generated";
import type { EngineAccess, EngineRoute } from "./engine-guard";

export type SearchLang = "de" | "en" | "fr";

export type ProfileKind = Profile["kind"];

export type SearchRequest = {
  readonly query: string;
  readonly lang?: SearchLang;
  /** Source ids from GET /api/sources; the engine refuses an id it does not hold. */
  readonly sources?: readonly string[];
  readonly kinds?: readonly ProfileKind[];
};

export type AgentMessage = { readonly role: "user" | "assistant"; readonly content: string };

export type AgentRequest = { readonly messages: readonly AgentMessage[] };

/** live: true lets this one call reach a model; anything else is answered from the cache. */
export type EngineCallOptions = { readonly live?: boolean };

/** The API's error markers (contracts/api.md); `rate_limited` is HTTP 429. */
export type EngineError = "bad_request" | "not_found" | "rate_limited" | "engine_error";

export type EngineResult<T> = { ok: true; value: T } | { ok: false; error: EngineError };

export type EngineClient = {
  search(
    request: SearchRequest,
    options?: EngineCallOptions,
  ): Promise<EngineResult<SearchResponse>>;
  brief(text: string, options?: EngineCallOptions): Promise<EngineResult<SearchResponse>>;
  agent(request: AgentRequest, options?: EngineCallOptions): Promise<EngineResult<AgentReply>>;
  sources(): Promise<EngineResult<SourcesList>>;
  numbers(): Promise<EngineResult<Numbers>>;
  health(): Promise<EngineResult<Health>>;
};

/** What a proxy route needs, passed in so a test can supply its own engine and guard. */
export type EngineProxy = {
  readonly engine: () => EngineClient;
  readonly guard: (request: Request, route: EngineRoute) => Promise<EngineAccess>;
};
