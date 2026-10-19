import { describe, expect, test } from "bun:test";
import agentJson from "../../../contracts/fixtures/agent.json";
import { resultFixture } from "@/test/fixtures";
import { createHttpLumiApi } from "./lumi-api";

type Sent = { path: string; init: RequestInit };

function answering(respond: () => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const api = createHttpLumiApi(async (path, init) => {
    sent.push({ path, init });
    return respond();
  });
  return { api, sent };
}

const hello = [{ role: "user", content: "Who works on glucose sensors?" }] as const;

describe("httpLumiApi", () => {
  test("posts the messages to the agent route as JSON and parses the reply", async () => {
    const { api, sent } = answering(() => Response.json(agentJson));
    const outcome = await api.ask(hello);
    expect(sent.map(({ path, init }) => [path, init.method, init.body])).toEqual([
      ["/api/agent", "POST", JSON.stringify({ messages: hello })],
    ]);
    expect(outcome.ok && outcome.value.mentions).toEqual([
      { profile_id: "person-example-ada-muster", name: "Ada Muster" },
    ]);
  });

  test("a 404, from the route or from Next itself, means not connected", async () => {
    const marker = answering(() => Response.json({ error: "not_found" }, { status: 404 }));
    expect(await marker.api.ask(hello)).toEqual({ ok: false, failure: "not_connected" });
    const page = answering(
      () => new Response("<!DOCTYPE html><title>404</title>", { status: 404 }),
    );
    expect(await page.api.ask(hello)).toEqual({ ok: false, failure: "not_connected" });
  });

  test("error markers, a failed request and an unreadable body are plain failures", async () => {
    const bad = answering(() => Response.json({ error: "bad_request" }, { status: 400 }));
    expect(await bad.api.ask(hello)).toEqual({ ok: false, failure: "bad_request" });
    const down = answering(() => new Response("upstream timed out at 10.0.0.3", { status: 502 }));
    expect(await down.api.ask(hello)).toEqual({ ok: false, failure: "engine_error" });
    const offline = answering(() => Promise.reject(new TypeError("fetch failed")));
    expect(await offline.api.ask(hello)).toEqual({ ok: false, failure: "network" });
    const partial = answering(() => Response.json({ ...agentJson, results: [{ query: "x" }] }));
    expect(await partial.api.ask(hello)).toEqual({ ok: false, failure: "malformed" });
  });

  test("the plain search posts the same words to the search route", async () => {
    const { api, sent } = answering(() => Response.json(resultFixture));
    const outcome = await api.search("glucose sensors");
    expect(sent.map(({ path, init }) => [path, init.body])).toEqual([
      ["/api/search", JSON.stringify({ query: "glucose sensors" })],
    ]);
    expect(outcome).toEqual({ ok: true, value: resultFixture });
  });
});
