import { describe, expect, test } from "bun:test";
import agent from "../../../../contracts/fixtures/agent.json";
import { createEngineClient } from "@/infrastructure/engine-client";
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

const cacheOnly = async () => ({ ok: true, live: false }) as const;

const ask = { role: "user", content: "Who works on glucose sensors?" };

function agentRequest(body: string): Request {
  return new Request("http://127.0.0.1:3000/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-bernlife-live": "1" },
    body,
  });
}

describe("proxyAgent", () => {
  test("forwards the conversation without the browser's x-bernlife-live header", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const response = await proxyAgent(agentRequest(JSON.stringify({ messages: [ask] })), {
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

  test("an engine without the agent answers not_found with status 404", async () => {
    const { engine } = engineAnswering(() =>
      Response.json({ error: "not_found" }, { status: 404 }),
    );
    const response = await proxyAgent(agentRequest(JSON.stringify({ messages: [ask] })), {
      engine,
      guard: cacheOnly,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("a conversation ending with the assistant is a bad request and is not forwarded", async () => {
    const { engine, sent } = engineAnswering(() => Response.json(agent));
    const answer = { role: "assistant", content: "Ada Muster." };
    const response = await proxyAgent(agentRequest(JSON.stringify({ messages: [ask, answer] })), {
      engine,
      guard: cacheOnly,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad_request" });
    expect(sent).toEqual([]);
  });
});
