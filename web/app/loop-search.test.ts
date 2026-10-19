import { describe, expect, test } from "bun:test";
import type { NavigatorApi, NavigatorOutcome } from "@/features/navigator/navigator-api";
import { resultFixture } from "@/test/fixtures";
import { loopSearch } from "./loop-search";

function answering(outcome: NavigatorOutcome) {
  const asked: unknown[] = [];
  const api: NavigatorApi = {
    search: async (request) => {
      asked.push(request);
      return outcome;
    },
    brief: async () => {
      throw new Error("a loop never reads a brief");
    },
  };
  return { search: loopSearch(api), asked };
}

describe("loopSearch", () => {
  test("asks the Navigator's search with the loop's words and passes the answer on", async () => {
    const { search, asked } = answering({ ok: true, response: resultFixture });
    expect(await search("insulin pumps")).toBe(resultFixture);
    expect(asked).toEqual([{ query: "insulin pumps" }]);
  });

  test("keeps a refusal over the limit apart from every other failure", async () => {
    const limited = answering({ ok: false, failure: { kind: "engine", error: "rate_limited" } });
    expect(await limited.search("q")).toBe("rate_limited");
    const down = answering({ ok: false, failure: { kind: "engine", error: "engine_error" } });
    expect(await down.search("q")).toBeNull();
    const offline = answering({ ok: false, failure: { kind: "network" } });
    expect(await offline.search("q")).toBeNull();
  });
});
