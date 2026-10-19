import { describe, expect, test } from "bun:test";
import { type JsonBody, readJsonBody } from "./json-body";

const limit = 1024;

function post(body: BodyInit, headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1:3000/api/agent", { method: "POST", headers, body });
}

const json = { "content-type": "application/json" };

/** A body with no declared length that never ends, counting the bytes taken from it. */
function endless() {
  let taken = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      taken += 256;
      controller.enqueue(new Uint8Array(256).fill(0x20));
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, taken: () => taken, cancelled: () => cancelled };
}

async function refusal(body: JsonBody): Promise<[number, unknown]> {
  if (body.ok) throw new Error("the body was accepted");
  return [body.response.status, await body.response.json()];
}

describe("readJsonBody", () => {
  test("parses a JSON body, with or without a charset", async () => {
    expect(await readJsonBody(post('{"query":"CGM"}', json), limit)).toEqual({
      ok: true,
      value: { query: "CGM" },
    });
    const withCharset = { "content-type": "Application/JSON; charset=utf-8" };
    expect(await readJsonBody(post("[1]", withCharset), limit)).toEqual({ ok: true, value: [1] });
  });

  test("refuses a text/plain or form body with 415, the types a page elsewhere can post", async () => {
    const plain = post('{"query":"CGM"}', { "content-type": "text/plain;charset=UTF-8" });
    expect(await refusal(await readJsonBody(plain, limit))).toEqual([
      415,
      { error: "bad_request" },
    ]);
    const form = new FormData();
    form.set("query", "CGM");
    expect(await refusal(await readJsonBody(post(form, {}), limit))).toEqual([
      415,
      { error: "bad_request" },
    ]);
  });

  test("refuses a declared length over the limit without reading the body", async () => {
    const body = endless();
    const declared = { ...json, "content-length": String(limit + 1) };
    expect(await refusal(await readJsonBody(post(body.stream, declared), limit))).toEqual([
      413,
      { error: "bad_request", reason: "too_large" },
    ]);
    expect(body.taken()).toBeLessThanOrEqual(256);
  });

  test("stops reading a body without a declared length once it passes the limit", async () => {
    const body = endless();
    expect(await refusal(await readJsonBody(post(body.stream, json), limit))).toEqual([
      413,
      { error: "bad_request", reason: "too_large" },
    ]);
    expect(body.cancelled()).toBe(true);
    expect(body.taken()).toBeLessThanOrEqual(limit + 2 * 256);
  });

  test("counts the limit in bytes, not characters", async () => {
    const fits = JSON.stringify("a".repeat(limit - 2));
    expect((await readJsonBody(post(fits, json), limit)).ok).toBe(true);
    const umlauts = JSON.stringify("ü".repeat(limit / 2));
    expect(await refusal(await readJsonBody(post(umlauts, json), limit))).toEqual([
      413,
      { error: "bad_request", reason: "too_large" },
    ]);
  });

  test("refuses a body that is not JSON, or none, with 400", async () => {
    expect(await refusal(await readJsonBody(post("{", json), limit))).toEqual([
      400,
      { error: "bad_request" },
    ]);
    const empty = new Request("http://127.0.0.1:3000/api/agent", { method: "POST", headers: json });
    expect(await refusal(await readJsonBody(empty, limit))).toEqual([
      400,
      { error: "bad_request" },
    ]);
  });
});
