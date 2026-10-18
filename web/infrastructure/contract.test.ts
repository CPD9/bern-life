import { describe, expect, test } from "bun:test";
import abstained from "../../contracts/fixtures/result-abstained.json";
import brief from "../../contracts/fixtures/result-brief.json";
import health from "../../contracts/fixtures/health.json";
import result from "../../contracts/fixtures/result.json";
import { copyOf } from "@/test/fixtures";
import { parseHealth, parseSearchResponse } from "./contract";

describe("parseSearchResponse", () => {
  test("accepts the result, abstained and brief fixtures", () => {
    expect(parseSearchResponse(result)?.query).toBe("glucose sensors");
    expect(parseSearchResponse(abstained)?.abstain_reason).toBe("no_verifiable_source");
    expect(parseSearchResponse(brief)?.brief_terms?.length).toBe(2);
  });

  test("rejects a response whose mode is not in the contract", () => {
    expect(parseSearchResponse({ ...copyOf(result), mode: "guess" })).toBeNull();
  });

  test("rejects a result whose reason cites nothing", () => {
    const mutated = copyOf(result);
    mutated.results[0]!.reason.cites = [];
    expect(parseSearchResponse(mutated)).toBeNull();
  });

  test("rejects a claim without its evidence span", () => {
    const mutated: unknown = JSON.parse(
      JSON.stringify(result).replace('"span":"Group Leader, Sensor Lab",', ""),
    );
    expect(parseSearchResponse(mutated)).toBeNull();
  });
});

describe("parseHealth", () => {
  test("accepts the health fixture and rejects an unknown count", () => {
    expect(parseHealth(health)?.counts).toEqual({ pages: 2, profiles: 2, sources: 1 });
    expect(parseHealth({ ...health, counts: { visitors: 3 } })).toBeNull();
  });
});
