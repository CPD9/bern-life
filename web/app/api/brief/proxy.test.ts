import { describe, expect, test } from "bun:test";
import brief from "../../../../contracts/fixtures/result-brief.json";
import { createEngineClient } from "@/infrastructure/engine-client";
import type { EngineAccess } from "@/infrastructure/engine-guard";
import { proxyBrief } from "./proxy";

function engineAnswering() {
  const sent: Record<string, string>[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (_url, init) => {
      sent.push(Object.fromEntries(new Headers(init?.headers).entries()));
      return Response.json(brief);
    },
    logError: () => {},
    timeoutMs: 1000,
  });
  return { engine: () => client, sent };
}

function guardAnswering(access: EngineAccess) {
  return async () => access;
}

function briefRequest(): Request {
  const form = new FormData();
  form.set("text", "We need a partner for wearable glucose sensing.");
  return new Request("http://127.0.0.1:3000/api/brief", {
    method: "POST",
    headers: { "x-bernlife-live": "1" },
    body: form,
  });
}

describe("proxyBrief", () => {
  test("a brief reaches the engine without the browser's x-bernlife-live header", async () => {
    const { engine, sent } = engineAnswering();
    const guard = guardAnswering({ ok: true, live: false });
    const response = await proxyBrief(briefRequest(), { engine, guard });
    expect(response.status).toBe(200);
    expect(sent).toEqual([{ "content-type": "application/json" }]);
  });

  test("only the guard's decision makes the call live", async () => {
    const { engine, sent } = engineAnswering();
    const guard = guardAnswering({ ok: true, live: true });
    await proxyBrief(briefRequest(), { engine, guard });
    expect(sent).toEqual([{ "content-type": "application/json", "x-bernlife-live": "1" }]);
  });

  test("a refusal from the guard is the answer and the engine is not asked", async () => {
    const { engine, sent } = engineAnswering();
    const refusal = Response.json({ error: "rate_limited" }, { status: 429 });
    const guard = guardAnswering({ ok: false, response: refusal });
    const response = await proxyBrief(briefRequest(), { engine, guard });
    expect(response).toBe(refusal);
    expect(sent).toEqual([]);
  });
});
