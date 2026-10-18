import { describe, expect, test } from "bun:test";
import result from "../../contracts/fixtures/result.json";
import { createEngineClient } from "./engine-client";

type Call = { url: string; method: string | undefined; body: unknown };

function clientReturning(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const logged: string[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (url, init) => {
      calls.push({
        url: url.href,
        method: init?.method,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return respond();
    },
    logError: (message) => logged.push(message),
    timeoutMs: 1000,
  });
  return { client, calls, logged };
}

describe("createEngineClient", () => {
  test("posts the search request and returns the parsed response", async () => {
    const { client, calls } = clientReturning(() => Response.json(result));
    const outcome = await client.search({ query: "glucose sensors", lang: "en" });
    expect(outcome.ok && outcome.value.results[0]?.profile.id).toBe("person-example-ada-muster");
    expect(calls).toEqual([
      {
        url: "http://127.0.0.1:8100/api/search",
        method: "POST",
        body: { query: "glucose sensors", lang: "en" },
      },
    ]);
  });

  test("sends the brief text as JSON", async () => {
    const { client, calls } = clientReturning(() => Response.json(result));
    await client.brief("We need a partner.");
    expect(calls[0]?.body).toEqual({ text: "We need a partner." });
  });

  test("maps HTTP errors to the API markers", async () => {
    expect(await clientReturning(() => new Response("", { status: 400 })).client.health()).toEqual({
      ok: false,
      error: "bad_request",
    });
    expect(await clientReturning(() => new Response("", { status: 404 })).client.health()).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await clientReturning(() => new Response("", { status: 503 })).client.health()).toEqual({
      ok: false,
      error: "engine_error",
    });
  });

  test("a body outside the contract is an engine error and is logged, not returned", async () => {
    const { client, logged } = clientReturning(() => Response.json({ ...result, mode: "guess" }));
    expect(await client.search({ query: "x" })).toEqual({ ok: false, error: "engine_error" });
    expect(logged).toEqual(["engine /api/search: body does not match the contract"]);
  });

  test("a network failure is an engine error", async () => {
    const { client, logged } = clientReturning(() => {
      throw new TypeError("connection refused");
    });
    expect(await client.health()).toEqual({ ok: false, error: "engine_error" });
    expect(logged).toEqual(["engine /api/health: request failed"]);
  });
});
