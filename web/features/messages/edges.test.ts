import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { decodeCursor, encodeCursor, parseLimit, parseStart } from "./input";
import { parseNotice } from "./notice";
import { Hub, eventStream } from "./live";
import type { Notice } from "./types";

const CONVERSATION = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "22222222-2222-4222-8222-222222222222";

describe("request input", () => {
  test("a start is a direct handle or a titled group of known-looking handles", () => {
    expect(parseStart({ kind: "direct", handle: " Bea " })).toEqual({
      kind: "direct",
      handle: "bea",
    });
    expect(
      parseStart({ kind: "group", title: " Bern Life ", handles: ["bea", "BEA", "cem"] }),
    ).toEqual({
      kind: "group",
      title: "Bern Life",
      handles: ["bea", "cem"],
    });
    expect(parseStart({ kind: "group", title: "", handles: ["bea"] })).toBeNull();
    expect(parseStart({ kind: "group", title: "x", handles: [] })).toBeNull();
    expect(parseStart({ kind: "channel" })).toBeNull();
  });

  test("a cursor round-trips and a forged one is refused; limits stay 1 to 50", () => {
    const cursor = { at: new Date("2026-10-18T21:00:00.123Z"), id: MESSAGE };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor(Buffer.from("yesterday|1").toString("base64url"))).toBe("invalid");
    expect(decodeCursor(null)).toBeNull();
    expect([parseLimit(null), parseLimit("20"), parseLimit("0"), parseLimit("51")]).toEqual([
      50,
      20,
      null,
      null,
    ]);
  });

  test("only notices we write are read off the channel", () => {
    const notice: Notice = { conversationId: CONVERSATION, messageId: MESSAGE, kind: "posted" };
    expect(parseNotice(JSON.stringify(notice))).toEqual(notice);
    expect(parseNotice('{"conversationId":"x","messageId":"y","kind":"posted"}')).toBeNull();
    expect(parseNotice("not json")).toBeNull();
  });
});

describe("eventStream", () => {
  test("sends an event per notice for a member, a heartbeat, and stops on abort", async () => {
    let publish: (payload: string) => void = () => {};
    const live = new Hub(
      async (_channel, onPayload) => {
        publish = onPayload;
      },
      async () => ["u-bea"],
    );
    const abort = new AbortController();
    const reader = eventStream(live, "u-bea", abort.signal, 20).getReader();
    const decoder = new TextDecoder();
    const read = async () => decoder.decode((await reader.read()).value);
    expect(await read()).toBe(": connected\n\n");
    publish(JSON.stringify({ conversationId: CONVERSATION, messageId: MESSAGE, kind: "posted" }));
    expect(await read()).toBe(
      `event: message\ndata: {"conversationId":"${CONVERSATION}","messageId":"${MESSAGE}","kind":"posted"}\n\n`,
    );
    expect(await read()).toBe(": ping\n\n");
    abort.abort();
    expect((await reader.read()).done).toBe(true);
  });
});

describe("privacy", () => {
  test("no engine code reads the message tables", () => {
    const engine = join(import.meta.dir, "..", "..", "..", "engine", "src");
    const touches = /\b(from|join|into|update)\s+"?(message|member|conversation)"?\b/i;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".py") && touches.test(readFileSync(path, "utf8")))
          offenders.push(path);
      }
    };
    walk(engine);
    expect(offenders).toEqual([]);
  });
});
