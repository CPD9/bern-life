import { describe, expect, test } from "bun:test";
import type { StoredNotification } from "./server-store";
import { inboxItem } from "./server-view";

const AT = new Date("2026-10-19T08:00:00Z");

function stored(kind: StoredNotification["kind"], about: unknown): StoredNotification {
  return {
    id: "n1",
    kind,
    createdAt: AT,
    read: false,
    about: about as StoredNotification["about"],
  };
}

const titles = (items: StoredNotification[]) => items.map((item) => inboxItem(item)?.title ?? null);

describe("what a notification says", () => {
  test("a connection is told from where you stand in it", () => {
    const about = (status: string, outgoing: boolean) =>
      stored("connection", { status, outgoing, handle: "bea", displayName: "Bea" });
    expect(
      titles([
        about("pending", false),
        about("accepted", true),
        about("accepted", false),
        about("declined", false),
        about("pending", true),
        about("withdrawn", false),
      ]),
    ).toEqual([
      "Bea asks to connect",
      "Bea accepted your request",
      "You and Bea are connected",
      "You declined Bea's request",
      null,
      null,
    ]);
  });

  test("a message names who wrote or the group, and nothing of what was said", () => {
    const item = inboxItem(
      stored("message", { kind: "direct", title: null, from: { displayName: "Ada" } }),
    );
    expect(item).toEqual({
      id: "n1",
      kind: "message",
      title: "New message from Ada",
      body: "Open Messages to read it.",
      at: "2026-10-19T08:00:00.000Z",
      read: false,
    });
    expect(
      titles([
        stored("message", { kind: "group", title: "Glucose Lab", from: { displayName: "Ada" } }),
        stored("message", { kind: "direct", title: null, from: null }),
        stored("message", null),
      ]),
    ).toEqual(["New message in Glucose Lab", "New message", null]);
  });
});
