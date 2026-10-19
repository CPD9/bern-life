import { describe, expect, test } from "bun:test";
import { formatInterval, formatMeasure, formatMillis, formatTally } from "./format";
import { parseNumbers } from "./numbers";
import { readNumbers } from "./numbers-api";
import { jsonResponse, numbersBody } from "./testing";

function omit(body: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([name]) => name !== key));
}

describe("parseNumbers", () => {
  test("keeps every value exactly as sent", () => {
    expect(parseNumbers(numbersBody())).toEqual(numbersBody());
  });

  test("eval null is an answer: the evaluator has not run", () => {
    const parsed = parseNumbers({ ...numbersBody(), eval: null });
    expect(parsed?.eval).toBeNull();
    expect(parsed?.models.map((model) => model.role)).toEqual(["expand", "brief"]);
  });

  const broken: [string, (body: ReturnType<typeof numbersBody>) => unknown][] = [
    ["not an object", () => "numbers"],
    ["no models", (body) => omit(body, "models")],
    ["eval left out", (body) => omit(body, "eval")],
    ["a date that is not a date", (body) => ({ ...body, generated_at: "yesterday" })],
    ["an empty snapshot", (body) => ({ ...body, snapshot: "" })],
    ["recall as a string", (body) => ({ ...body, eval: { ...body.eval, mrr: "0.31" } })],
    [
      "recall above 1",
      (body) => ({ ...body, eval: { ...body.eval, recall_at_10: { value: 4, low: 0, high: 1 } } }),
    ],
    [
      "an interval without its high end",
      (body) => ({ ...body, eval: { ...body.eval, recall_at_10: { value: 0.4, low: 0.2 } } }),
    ],
    ["n above of", (body) => ({ ...body, eval: { ...body.eval, traceable: { n: 9, of: 8 } } })],
    ["a fractional count", (body) => ({ ...body, eval: { ...body.eval, invented_entities: 0.5 } })],
    ["a slice with no name", (body) => ({ ...body, eval: { ...body.eval, slices: [{}] } })],
    ["more ok than calls", (body) => ({ ...body, models: [{ ...body.models[0], ok: 121 }] })],
    [
      "a latency as text",
      (body) => ({ ...body, models: [{ ...body.models[0], median_ms: "584 ms" }] }),
    ],
  ];
  for (const [name, breakIt] of broken) {
    test(`a body with ${name} does not parse`, () => {
      expect(parseNumbers(breakIt(numbersBody()))).toBeNull();
    });
  }
});

describe("readNumbers", () => {
  test("a good body is ok", async () => {
    expect(await readNumbers(async () => jsonResponse(numbersBody()))).toEqual({
      status: "ok",
      numbers: numbersBody(),
    });
  });

  test("404, from the engine or from Next, means not connected yet", async () => {
    const engine = await readNumbers(async () => jsonResponse({ error: "not_found" }, 404));
    const next = await readNumbers(async () => new Response("<!DOCTYPE html>", { status: 404 }));
    expect([engine, next]).toEqual([{ status: "not_connected" }, { status: "not_connected" }]);
  });

  test("a server error, a network failure, HTML and a malformed body are errors", async () => {
    const outcomes = await Promise.all([
      readNumbers(async () => jsonResponse({ error: "engine_error" }, 502)),
      readNumbers(async () => {
        throw new TypeError("Failed to fetch");
      }),
      readNumbers(async () => new Response("<html></html>", { status: 200 })),
      readNumbers(async () => jsonResponse({ ...numbersBody(), models: "none" })),
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(["error", "error", "error", "error"]);
  });
});

describe("format", () => {
  test("an interval, a tally and latencies are written exactly as given", () => {
    expect(formatInterval({ value: 0.4375, low: 0.29, high: 0.58 })).toBe("0.4375 [0.29, 0.58]");
    expect(formatTally({ n: 7, of: 10 })).toBe("7 / 10");
    expect(formatMeasure(0.5)).toBe("0.5");
    expect(formatMillis(1210.5)).toBe("1210.5 ms");
    expect(formatMillis(null)).toBe("not recorded");
  });
});
