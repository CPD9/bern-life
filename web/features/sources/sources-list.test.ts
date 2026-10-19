import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../contracts/source.schema.json";
import { exampleSource, guideSteps, sourceFields } from "./source-guide";
import { readSources } from "./sources-api";
import { formatFetchedDate, parseSourcesList, siteRoot } from "./sources-list";
import { jsonResponse, sourcesBody } from "./testing";

describe("parseSourcesList", () => {
  test("keeps every source exactly as sent, including one with no pages yet", () => {
    expect(parseSourcesList(sourcesBody())).toEqual(sourcesBody());
  });

  const broken: [string, (body: ReturnType<typeof sourcesBody>) => unknown][] = [
    ["not an object", () => []],
    ["no snapshot", ({ sources }) => ({ sources })],
    ["sources as an object", (body) => ({ ...body, sources: {} })],
    ["a host that is a URL", (body) => withSource(body, { hosts: ["javascript:alert(1)"] })],
    ["a host with a path", (body) => withSource(body, { hosts: ["demo.test/team"] })],
    ["pages as text", (body) => withSource(body, { pages: "42" })],
    ["negative profiles", (body) => withSource(body, { profiles: -1 })],
    ["a fetch date that is not a date", (body) => withSource(body, { newest_fetched_at: "soon" })],
    ["a kind that is not text", (body) => withSource(body, { kinds: [3] })],
  ];
  for (const [name, breakIt] of broken) {
    test(`a body with ${name} does not parse`, () => {
      expect(parseSourcesList(breakIt(sourcesBody()))).toBeNull();
    });
  }

  test("a host links to its public site root; dates are days in Bern", () => {
    expect(siteRoot("www.demo-institute.test")).toBe("https://www.demo-institute.test/");
    expect(formatFetchedDate("2026-10-18T22:30:00Z")).toBe("19 Oct 2026");
  });
});

function withSource(body: ReturnType<typeof sourcesBody>, change: Record<string, unknown>) {
  return { ...body, sources: [{ ...body.sources[0], ...change }] };
}

describe("readSources", () => {
  test("404, from the engine or from Next, means not connected yet", async () => {
    const engine = await readSources(async () => jsonResponse({ error: "not_found" }, 404));
    const next = await readSources(async () => new Response("<!DOCTYPE html>", { status: 404 }));
    expect([engine, next]).toEqual([{ status: "not_connected" }, { status: "not_connected" }]);
  });

  test("a good body is ok; a failure, HTML or a malformed body is an error", async () => {
    expect(await readSources(async () => jsonResponse(sourcesBody()))).toEqual({
      status: "ok",
      list: sourcesBody(),
    });
    const failures = await Promise.all([
      readSources(async () => jsonResponse({ error: "engine_error" }, 502)),
      readSources(async () => {
        throw new TypeError("Failed to fetch");
      }),
      readSources(async () => new Response("<html></html>")),
      readSources(async () => jsonResponse({ snapshot: "s", sources: [{}] })),
    ]);
    expect(failures.map((outcome) => outcome.status)).toEqual(["error", "error", "error", "error"]);
  });
});

describe("source guide", () => {
  test("lists the schema's own required and optional fields", () => {
    expect(sourceFields).toEqual([
      { where: "The file", required: ["id", "name", "sites", "crawl"], optional: ["page_types"] },
      {
        where: "Each entry in sites",
        required: ["host", "unit", "seeds"],
        optional: ["allow_paths", "deny_paths"],
      },
      { where: "crawl", required: ["max_pages_per_site", "delay_s"], optional: ["max_depth"] },
    ]);
  });

  test("the invented example is a valid source file", () => {
    const ajv = new Ajv2020({ strict: true });
    addFormats(ajv);
    const valid = ajv.validate(schema, exampleSource);
    expect(ajv.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  test("the steps crawl and extract the example's id", () => {
    expect(guideSteps.flatMap((step) => step.commands)).toEqual([
      "python contracts/check.py",
      "python -m bernlife crawl --source demo-institute",
      "python -m bernlife extract --source demo-institute",
      "python -m bernlife enrich",
      "python -m bernlife embed",
      "python -m bernlife load",
    ]);
  });
});
