// The search the map shows lit when the app runs with DEMO_FIXTURES=1: invented people on real
// hosts, at /fixture/ paths that do not exist, marked as a fixture so the UI labels it. It is read on
// the server and passed to the world, so engine mode never ships it to the browser.

import { parseSearchResponse } from "@/infrastructure/contract";
import { type SearchResponse } from "@/infrastructure/contract-types.generated";
import searchGlucose from "./fixtures/search-glucose.json";

export function worldDemoSearch(): SearchResponse {
  const parsed = parseSearchResponse(searchGlucose);
  if (parsed === null) throw new Error("The world fixture does not match result.schema.json");
  return parsed;
}
