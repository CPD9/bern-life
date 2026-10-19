import { type SourcesList, parseSourcesList } from "./sources-list";

/** A 404 means the route is not there yet (Next's own page or the engine's `not_found`). */
export type SourcesOutcome =
  | { readonly status: "ok"; readonly list: SourcesList }
  | { readonly status: "not_connected" }
  | { readonly status: "error" };

export type SourcesApi = { list(): Promise<SourcesOutcome> };

const ERROR: SourcesOutcome = { status: "error" };

export async function readSources(fetchSources: () => Promise<Response>): Promise<SourcesOutcome> {
  let response: Response;
  try {
    response = await fetchSources();
  } catch {
    return ERROR;
  }
  if (response.status === 404) return { status: "not_connected" };
  if (!response.ok) return ERROR;
  const list = parseSourcesList(await response.json().catch(() => null));
  return list ? { status: "ok", list } : ERROR;
}

export const httpSourcesApi: SourcesApi = {
  list: () => readSources(() => fetch("/api/sources")),
};
