import { expect, test } from "bun:test";
import brief from "../../../../contracts/fixtures/result-brief.json";
import { createEngineClient } from "@/infrastructure/engine-client";
import { proxyBrief } from "./proxy";

test("a brief reaches the engine without the browser's x-bernlife-live header", async () => {
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
  const form = new FormData();
  form.set("text", "We need a partner for wearable glucose sensing.");
  const request = new Request("http://127.0.0.1:3000/api/brief", {
    method: "POST",
    headers: { "x-bernlife-live": "1" },
    body: form,
  });
  const response = await proxyBrief(request, {
    engine: () => client,
    guard: async () => ({ ok: true, live: false }),
  });
  expect(response.status).toBe(200);
  expect(sent).toEqual([{ "content-type": "application/json" }]);
});
