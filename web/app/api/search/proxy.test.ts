import { describe, expect, test } from "bun:test";
import result from "../../../../contracts/fixtures/result.json";
import { createEngineClient } from "@/infrastructure/engine-client";
import type { EngineAccess } from "@/infrastructure/engine-guard";
import { proxySearch } from "./proxy";

type Sent = { headers: Record<string, string>; body: unknown };

function engineAnswering(answer: () => Response) {
  const sent: Sent[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (_url, init) => {
      sent.push({
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return answer();
    },
    logError: () => {},
    timeoutMs: 1000,
  });
  return { engine: () => client, sent };
}

function guardAnswering(access: EngineAccess) {
  return async () => access;
}

function searchRequest(body: unknown): Request {
  return new Request("http://127.0.0.1:3000/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-bernlife-live": "1" },
    body: JSON.stringify(body),
  });
}

describe("proxySearch", () => {
  test("a browser's x-bernlife-live header never reaches the engine", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(result));
    const guard = guardAnswering({ ok: true, live: false });
    const response = await proxySearch(searchRequest({ query: "glucose sensors" }), {
      engine,
      guard,
    });
    expect(response.status).toBe(200);
    expect(sent).toEqual([
      { headers: { "content-type": "application/json" }, body: { query: "glucose sensors" } },
    ]);
  });

  test("only the guard's decision makes the call live", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(result));
    const guard = guardAnswering({ ok: true, live: true });
    await proxySearch(searchRequest({ query: "glucose sensors" }), { engine, guard });
    expect(sent[0]?.headers["x-bernlife-live"]).toBe("1");
  });

  test("passes the kinds to the engine", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(result));
    const guard = guardAnswering({ ok: true, live: false });
    await proxySearch(searchRequest({ query: "seed grant", kinds: ["call"] }), { engine, guard });
    expect(sent[0]?.body).toEqual({ query: "seed grant", kinds: ["call"] });
  });

  test("a refusal from the guard is the answer and the engine is not asked", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(result));
    const refusal = Response.json({ error: "rate_limited" }, { status: 429 });
    const guard = guardAnswering({ ok: false, response: refusal });
    const response = await proxySearch(searchRequest({ query: "CGM" }), { engine, guard });
    expect(response).toBe(refusal);
    expect(sent).toEqual([]);
  });

  test("an unknown kind is a bad request", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(result));
    const guard = guardAnswering({ ok: true, live: false });
    const response = await proxySearch(searchRequest({ query: "CGM", kinds: ["listing"] }), {
      engine,
      guard,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad_request" });
    expect(sent).toEqual([]);
  });
});
