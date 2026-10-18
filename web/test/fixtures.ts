import abstained from "../../contracts/fixtures/result-abstained.json";
import brief from "../../contracts/fixtures/result-brief.json";
import health from "../../contracts/fixtures/health.json";
import result from "../../contracts/fixtures/result.json";
import via from "../../contracts/fixtures/result-via.json";
import { parseHealth, parseSearchResponse } from "@/infrastructure/contract";
import type { Health, SearchResponse } from "@/infrastructure/contract-types.generated";

function parsed<T>(value: T | null): T {
  if (value === null) throw new Error("fixture does not match its schema");
  return value;
}

export const resultFixture: SearchResponse = parsed(parseSearchResponse(result));
export const abstainedFixture: SearchResponse = parsed(parseSearchResponse(abstained));
export const briefFixture: SearchResponse = parsed(parseSearchResponse(brief));
export const viaFixture: SearchResponse = parsed(parseSearchResponse(via));
export const healthFixture: Health = parsed(parseHealth(health));

/** A deep copy that a test may change without touching the shared fixture. */
export function copyOf<T>(value: T): T {
  return structuredClone(value);
}
