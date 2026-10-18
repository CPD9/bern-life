import type { Health, SearchResponse } from "./contract-types.generated";

export type SearchLang = "de" | "en" | "fr";

export type SearchRequest = {
  readonly query: string;
  readonly lang?: SearchLang;
};

export type EngineError = "bad_request" | "not_found" | "engine_error";

export type EngineResult<T> = { ok: true; value: T } | { ok: false; error: EngineError };

export type EngineClient = {
  search(request: SearchRequest): Promise<EngineResult<SearchResponse>>;
  brief(text: string): Promise<EngineResult<SearchResponse>>;
  health(): Promise<EngineResult<Health>>;
};
