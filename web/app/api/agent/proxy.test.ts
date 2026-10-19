import { describe, expect, test } from "bun:test";
import agent from "../../../../contracts/fixtures/agent.json";
import { maxAgentBodyBytes } from "@/infrastructure/agent-request";
import { createEngineClient } from "@/infrastructure/engine-client";
import type { EngineAccess } from "@/infrastructure/engine-guard";
import { proxyAgent } from "./proxy";

type Sent = { url: string; headers: Record<string, string>; body: unknown };

function engineAnswering(answer: () => Response) {
  const sent: Sent[] = [];
  const client = createEngineClient({
    baseUrl: new URL("http://127.0.0.1:8100"),
    fetch: async (url, init) => {
      sent.push({
        url: url.href,
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

/** A guard giving `access`, counting how often it is asked. */
function guardAnswering(access: EngineAccess) {
  let asked = 0;
  const guard = async () => {
    asked += 1;
    return access;
  };
  return { guard, asked: () => asked };
}

const cacheOnly = guardAnswering({ ok: true, live: false }).guard;

const ask = { role: "user", content: "Who works on glucose sensors?" };

function conversation(...messages: unknown[]): string {
  return JSON.stringify({ messages });
}

function agentRequest(body: string, contentType = "application/json"): Request {
  return new Request("http://127.0.0.1:3000/api/agent", {
    method: "POST",
    headers: { "content-type": contentType, "x-bernlife-live": "1" },
    body,
  });
}

describe("proxyAgent", () => {
  test("forwards the conversation without the browser's x-bernlife-live header", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const response = await proxyAgent(agentRequest(conversation(ask)), {
      engine,
      guard: cacheOnly,
    });
    expect(await response.json()).toEqual(agent);
    expect(sent).toEqual([
      {
        url: "http://127.0.0.1:8100/api/agent",
        headers: { "content-type": "application/json" },
        body: { messages: [ask] },
      },
    ]);
  });

  test("only the guard's decision makes the call live", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const { guard } = guardAnswering({ ok: true, live: true });
    await proxyAgent(agentRequest(conversation(ask)), { engine, guard });
    expect(sent.map((call) => call.headers)).toEqual([
      { "content-type": "application/json", "x-bernlife-live": "1" },
    ]);
  });

  test("a refusal from the guard is the answer and the engine is not asked", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const refusal = Response.json({ error: "rate_limited" }, { status: 429 });
    const { guard } = guardAnswering({ ok: false, response: refusal });
    const response = await proxyAgent(agentRequest(conversation(ask)), { engine, guard });
    expect(response).toBe(refusal);
    expect(sent).toEqual([]);
  });

  test("an engine without the agent answers not_found with status 404", async () => {
    const { engine } = engineAnswering(() =>
      Response.json({ error: "not_found" }, { status: 404 }),
    );
    const response = await proxyAgent(agentRequest(conversation(ask)), {
      engine,
      guard: cacheOnly,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("a conversation ending with the assistant is a bad request and is not forwarded", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const answer = { role: "assistant", content: "Ada Muster." };
    const response = await proxyAgent(agentRequest(conversation(ask, answer)), {
      engine,
      guard: cacheOnly,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad_request" });
    expect(sent).toEqual([]);
  });

  test("a text/plain post, as a page on another site can send, is refused before the guard", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const { guard, asked } = guardAnswering({ ok: true, live: true });
    const crossSite = agentRequest(conversation(ask), "text/plain;charset=UTF-8");
    const response = await proxyAgent(crossSite, { engine, guard });
    expect(response.status).toBe(415);
    expect(asked()).toBe(0);
    expect(sent).toEqual([]);
  });

  test("a body over 16 KB is refused with 413", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const envelope = conversation({ role: "user", content: "" }).length;
    const fits = "a".repeat(maxAgentBodyBytes - envelope);
    const accepted = await proxyAgent(agentRequest(conversation({ role: "user", content: fits })), {
      engine,
      guard: cacheOnly,
    });
    expect(accepted.status).toBe(200);
    const refused = await proxyAgent(
      agentRequest(conversation({ role: "user", content: `${fits}a` })),
      { engine, guard: cacheOnly },
    );
    expect(refused.status).toBe(413);
    expect(await refused.json()).toEqual({ error: "bad_request", reason: "too_large" });
    expect(sent.length).toBe(1);
  });
});
