import { describe, expect, test } from "bun:test";
import agent from "../../contracts/fixtures/agent.json";
import numbers from "../../contracts/fixtures/numbers.json";
import result from "../../contracts/fixtures/result.json";
import sources from "../../contracts/fixtures/sources.json";
import { createEngineClient } from "./engine-client";

type Call = {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
};

function clientReturning(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const logged: string[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (url, init) => {
      calls.push({
        url: url.href,
        method: init?.method,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
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
        headers: { "content-type": "application/json" },
        body: { query: "glucose sensors", lang: "en" },
      },
    ]);
  });

  test("passes the kinds to search through", async () => {
    const { client, calls } = clientReturning(() => Response.json(result));
    await client.search({ query: "seed grant", kinds: ["call", "space"] });
    expect(calls[0]?.body).toEqual({ query: "seed grant", kinds: ["call", "space"] });
  });

  test("sends the brief text as JSON", async () => {
    const { client, calls } = clientReturning(() => Response.json(result));
    await client.brief("We need a partner.");
    expect(calls[0]?.body).toEqual({ text: "We need a partner." });
  });

  test("posts the conversation to the agent and returns the parsed reply", async () => {
    const { client, calls } = clientReturning(() => Response.json(agent));
    const messages = [{ role: "user", content: "Who works on glucose sensors?" }] as const;
    const outcome = await client.agent({ messages });
    expect(outcome.ok && outcome.value.mentions[0]?.name).toBe("Ada Muster");
    expect(calls).toEqual([
      {
        url: "http://127.0.0.1:8100/api/agent",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: { messages },
      },
    ]);
  });

  test("reads the sources and the numbers with GET", async () => {
    const listed = clientReturning(() => Response.json(sources));
    const listing = await listed.client.sources();
    expect(listing.ok && listing.value.sources.length).toBe(3);
    const measured = clientReturning(() => Response.json(numbers));
    const measuring = await measured.client.numbers();
    expect(measuring.ok && measuring.value.eval?.queries).toBe(48);
    expect([...listed.calls, ...measured.calls]).toEqual([
      { url: "http://127.0.0.1:8100/api/sources", method: "GET", headers: {}, body: undefined },
      { url: "http://127.0.0.1:8100/api/numbers", method: "GET", headers: {}, body: undefined },
    ]);
  });

  test("marks a call live only when live is true", async () => {
    const { client, calls } = clientReturning(() => Response.json(result));
    await client.search({ query: "CGM" }, { live: true });
    await client.brief("We need a partner.", { live: true });
    await client.search({ query: "CGM" }, { live: false });
    await client.search({ query: "CGM" }, {});
    await client.brief("We need a partner.");
    expect(calls.map((call) => call.headers["x-bernlife-live"] ?? null)).toEqual([
      "1",
      "1",
      null,
      null,
      null,
    ]);
  });

  test("marks an agent call live only when live is true", async () => {
    const { client, calls } = clientReturning(() => Response.json(agent));
    const messages = [{ role: "user", content: "CGM" }] as const;
    await client.agent({ messages }, { live: true });
    await client.agent({ messages }, { live: false });
    await client.agent({ messages });
    expect(calls.map((call) => call.headers["x-bernlife-live"] ?? null)).toEqual(["1", null, null]);
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
    expect(await clientReturning(() => new Response("", { status: 404 })).client.sources()).toEqual(
      { ok: false, error: "not_found" },
    );
    expect(
      await clientReturning(() => new Response("", { status: 429 })).client.search({ query: "x" }),
    ).toEqual({ ok: false, error: "rate_limited" });
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
