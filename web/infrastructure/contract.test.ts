import { describe, expect, test } from "bun:test";
import agent from "../../contracts/fixtures/agent.json";
import health from "../../contracts/fixtures/health.json";
import numbers from "../../contracts/fixtures/numbers.json";
import abstained from "../../contracts/fixtures/result-abstained.json";
import brief from "../../contracts/fixtures/result-brief.json";
import opportunities from "../../contracts/fixtures/result-opportunities.json";
import via from "../../contracts/fixtures/result-via.json";
import result from "../../contracts/fixtures/result.json";
import sources from "../../contracts/fixtures/sources.json";
import { copyOf } from "@/test/fixtures";
import {
  parseAgentReply,
  parseHealth,
  parseNumbers,
  parseSearchResponse,
  parseSourcesList,
} from "./contract";

describe("parseSearchResponse", () => {
  test("accepts the result, abstained, brief and via fixtures", () => {
    expect(parseSearchResponse(result)?.query).toBe("glucose sensors");
    expect(parseSearchResponse(abstained)?.abstain_reason).toBe("no_verifiable_source");
    expect(parseSearchResponse(brief)?.brief_terms?.length).toBe(2);
    expect(parseSearchResponse(via)?.results.map((r) => r.via?.kind)).toEqual([
      "leads",
      "works_on",
    ]);
  });

  test("accepts the opportunities fixture with a call, a service and a space", () => {
    expect(parseSearchResponse(opportunities)?.results.map((r) => r.profile.kind)).toEqual([
      "call",
      "service",
      "space",
    ]);
  });

  test("rejects a via without the related profile's matching claims", () => {
    const mutated = copyOf(via);
    mutated.results[0]!.via.related_claims = [];
    expect(parseSearchResponse(mutated)).toBeNull();
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

  test("accepts status, uptime, failures per role and marker, and the budget", () => {
    const degraded = {
      ...health,
      status: "degraded",
      uptime_s: 3600,
      failures_last_hour: { explain: { timeout: 2, http_503: 1 } },
      budget: { limit: 200, used: 200 },
    };
    expect(parseHealth(degraded)?.failures_last_hour).toEqual({
      explain: { timeout: 2, http_503: 1 },
    });
  });

  test("rejects error text in place of a marker, a zero count and an unknown status", () => {
    const failures = (counts: Record<string, number>) => ({
      ...health,
      failures_last_hour: { explain: counts },
    });
    expect(parseHealth(failures({ "Connection refused by 10.0.0.1": 1 }))).toBeNull();
    expect(parseHealth(failures({ timeout: 0 }))).toBeNull();
    expect(parseHealth({ ...health, status: "fine" })).toBeNull();
  });
});

describe("parseAgentReply", () => {
  test("accepts the agent fixture", () => {
    expect(parseAgentReply(agent)?.mentions).toEqual([
      { profile_id: "person-example-ada-muster", name: "Ada Muster" },
    ]);
  });

  test("rejects an action the app does not offer and a reply without its results", () => {
    expect(parseAgentReply({ ...agent, actions: [{ type: "send_email", result: 0 }] })).toBeNull();
    const withoutResults: Record<string, unknown> = copyOf(agent);
    delete withoutResults.results;
    expect(parseAgentReply(withoutResults)).toBeNull();
  });
});

describe("parseSourcesList", () => {
  test("accepts the sources fixture", () => {
    expect(parseSourcesList(sources)?.sources.map((s) => [s.id, s.pages])).toEqual([
      ["example", 48],
      ["example-clinic", 21],
      ["example-foundation", 0],
    ]);
  });

  test("rejects a missing fetch date on a source with pages, and an unknown kind", () => {
    const undated = copyOf(sources);
    undated.sources[0]!.newest_fetched_at = null;
    expect(parseSourcesList(undated)).toBeNull();
    const listing = copyOf(sources);
    listing.sources[0]!.kinds = ["listing"];
    expect(parseSourcesList(listing)).toBeNull();
  });
});

describe("parseNumbers", () => {
  test("accepts the numbers fixture, and no evaluation as null", () => {
    expect(parseNumbers(numbers)?.eval?.recall_at_10).toEqual({
      value: 0.5,
      low: 0.35,
      high: 0.65,
    });
    expect(parseNumbers({ ...numbers, eval: null })?.eval).toBeNull();
  });

  test("rejects a share above 1, an interval for a slice and a model without latency", () => {
    const above = copyOf(numbers);
    above.eval.mrr = 1.5;
    expect(parseNumbers(above)).toBeNull();
    const interval: unknown = JSON.parse(
      JSON.stringify(numbers).replace(
        '"recall_at_10":0.4',
        '"recall_at_10":{"value":0.4,"low":0.2,"high":0.6}',
      ),
    );
    expect(parseNumbers(interval)).toBeNull();
    const noLatency = copyOf(numbers);
    Object.assign(noLatency.models[0]!, { median_ms: null });
    expect(parseNumbers(noLatency)).toBeNull();
  });
});
