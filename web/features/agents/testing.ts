// Invented search answers for the loop tests: the contract fixture's one result, repeated under
// new ids and kinds, so a test states exactly which results a run returns.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { copyOf, resultFixture } from "@/test/fixtures";
import type { Kind } from "./kinds";
import type { LoopEntry } from "./loops";

export function responseWith(
  snapshot: string,
  results: readonly (readonly [string, Kind])[],
  mode: SearchResponse["mode"] = "replay",
): SearchResponse {
  const response = copyOf(resultFixture);
  const template = response.results[0];
  if (template === undefined) throw new Error("fixture has no result");
  response.mode = mode;
  response.versions.snapshot = snapshot;
  response.results = results.map(([id, kind], index) => {
    const result = copyOf(template);
    result.rank = index + 1;
    result.profile.id = id;
    result.profile.kind = kind;
    result.profile.name.value = `Name ${id}`;
    result.profile.source_url = `https://www.example-institute.test/${id}`;
    return result;
  });
  return response;
}

export function entry(id: string, kind: Kind = "person"): LoopEntry {
  return { id, name: `Name ${id}`, kind, href: `https://www.example-institute.test/${id}` };
}

export function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}
